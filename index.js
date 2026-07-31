const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const express = require('express');

// Serwer HTTP dla Render.com + auto-ping
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Ziomeczki.gg działa!'));
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

// Samopinging (zapobiega uśpieniu bota przez Render)
setInterval(() => {
  if (process.env.RENDER_EXTERNAL_URL) {
    fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }
}, 10 * 60 * 1000);

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates // Wymagane do wykrywania ruchu na kanałach głosowych!
  ] 
});

// Konfiguracja ID kanałów, ról oraz chronionego użytkownika
const VERIFY_CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

const COUNTING_CHANNEL_ID = '1532453185413972038';
const GIVEAWAY_CHANNEL_ID = '1532418596159095105';

// --- KONFIGURACJA WŁASNYCH KANAŁÓW GŁOSOWYCH ---
const CREATE_VOICE_CHANNEL_ID = '1532548526825803878'; 
const VOICE_CATEGORY_ID = '1532550008833048796';

let currentCount = 0;
let lastUserId = null;

const PROTECTED_USER_ID = '1463274528930009332';

const activeCaptchas = new Map();
const giveawayParticipants = new Map();
// Śledzenie stworzonych kanałów głosowych: Set<channelId>
const tempVoiceChannels = new Set();

client.on('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);
});

// --- OBSŁUGA KANAŁÓW GŁOSOWYCH (WŁASNY KANAŁ) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member;
  if (!member || member.user.bot) return;

  // Użytkownik wszedł na kanał tworzący
  if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
    try {
      const guild = newState.guild;
      const channelName = `🎙️ Kanał - ${member.user.username}`;

      // Tworzenie prywatnego kanału głosowego
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: VOICE_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
          },
          {
            id: member.id,
            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers], // Właściciel może zarządzać kanałem
          }
        ]
      });

      tempVoiceChannels.add(channel.id);
      await member.voice.setChannel(channel).catch(() => {});
    } catch (err) {
      console.error('Błąd podczas tworzenia kanału głosowego:', err);
    }
  }

  // Użytkownik opuścił kanał (sprawdzamy czy to był pusty kanał tymczasowy)
  if (oldState.channelId && tempVoiceChannels.has(oldState.channelId)) {
    const oldChannel = oldState.channel;
    if (oldChannel && oldChannel.members.size === 0) {
      tempVoiceChannels.delete(oldChannel.id);
      await oldChannel.delete().catch(() => {});
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // --- ANTY-PING Z TIMEOUTEM 10 MINUT ---
  if (message.mentions.users.has(PROTECTED_USER_ID)) {
    await message.delete().catch(() => {});
    
    try {
      const member = await message.guild.members.fetch(message.author.id);
      await member.timeout(10 * 60 * 1000, 'Próba oznaczania chronionego użytkownika');
      
      const warning = await message.channel.send(`⚠️ <@${message.author.id}>, nie wolno oznaczać tej osoby! Otrzymujesz timeout na 10 minut.`);
      setTimeout(() => warning.delete().catch(() => {}), 7000);
    } catch (err) {
      console.error('Nie udało się nałożyć timeoutu:', err);
    }
    return;
  }

  // --- KOMENDA KONKURSU: !konkurs [minuty] [nagroda] ---
  if (message.content.startsWith('!konkurs') && message.channel.id === GIVEAWAY_CHANNEL_ID) {
    const args = message.content.slice(8).trim().split(' ');
    const minutes = parseInt(args[0]);
    const prize = args.slice(1).join(' ');

    if (isNaN(minutes) || !prize) {
      const errReply = await message.reply('❌ Błędny format! Użyj: `!konkurs [minuty] [nagroda]` (np. `!konkurs 5 Klucz do gry`)');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      await message.delete().catch(() => {});
      return;
    }

    await message.delete().catch(() => {});

    const endTime = Math.floor(Date.now() / 1000) + (minutes * 60);

    const embed = new EmbedBuilder()
      .setTitle('🎉 KONKURS 🎉')
      .setDescription(`Nagroda: **${prize}**\n\nKliknij przycisk poniżej, aby wziąć udział!\nKoniec za: <t:${endTime}:R>`)
      .setColor('Green')
      .setFooter({ text: `Konkurs stworzył: ${message.author.tag}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_giveaway')
        .setLabel('Weź udział')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎉')
    );

    const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
    giveawayParticipants.set(giveawayMsg.id, new Set());

    setTimeout(async () => {
      const participantsSet = giveawayParticipants.get(giveawayMsg.id);
      const participants = Array.from(participantsSet || []);

      const endedEmbed = new EmbedBuilder()
        .setTitle('🎉 KONKURS ROZSTRZYGNIĘTY 🎉')
        .setDescription(`Nagroda: **${prize}**\n\nLiczba uczestników: **${participants.length}**`)
        .setColor('Green');

      if (participants.length === 0) {
        endedEmbed.addFields({ name: 'Zwycięzca', value: 'Nikt nie wziął udziału w konkursie.' });
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] });
        await message.channel.send('❌ Konkurs zakończony, brak uczestników.');
      } else {
        const winnerId = participants[Math.floor(Math.random() * participants.length)];
        endedEmbed.addFields({ name: 'Zwycięzca', value: `<@${winnerId}>! Gratulacje! 🏆` });
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] });
        await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**!`);
      }

      giveawayParticipants.delete(giveawayMsg.id);
    }, minutes * 60 * 1000);

    return;
  }

  // Komenda weryfikacji
  if (message.content === '!setup-weryfikacja' && message.channel.id === VERIFY_CHANNEL_ID) {
    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja Bezpieczeństwa')
      .setDescription('Kliknij poniższy przycisk, aby rozpocząć weryfikację.')
      .setColor('Green');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_captcha')
        .setLabel('Zweryfikuj się')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    return;
  }

  // --- SYSTEM LICZENIA ---
  if (message.channel.id === COUNTING_CHANNEL_ID) {
    const number = parseInt(message.content.trim());
    
    if (isNaN(number) || message.content.trim() !== number.toString()) {
      await message.delete().catch(() => {});
      return;
    }

    if (number !== currentCount + 1) {
      await message.delete().catch(() => {});
      return;
    }

    if (message.author.id === lastUserId) {
      await message.delete().catch(() => {});
      return;
    }

    currentCount = number;
    lastUserId = message.author.id;
    await message.react('✅').catch(() => {});
    return;
  }
});

// Obsługa interakcji (Przyciski: Weryfikacja + Konkursy)
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_giveaway') {
    const participants = giveawayParticipants.get(interaction.message.id);
    if (!participants) {
      return interaction.reply({ content: '❌ Ten konkurs już się zakończył.', ephemeral: true });
    }

    if (participants.has(interaction.user.id)) {
      participants.delete(interaction.user.id);
      return interaction.reply({ content: '⚠️ Wypisałeś się z konkursu.', ephemeral: true });
    } else {
      participants.add(interaction.user.id);
      return interaction.reply({ content: '✅ Zostałeś zapisany do konkursu! Powodzenia!', ephemeral: true });
    }
  }

  if (interaction.customId === 'start_captcha') {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;

    activeCaptchas.set(interaction.user.id, answer);

    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja CAPTCHA')
      .setDescription(`Napisz na tym kanale (w wiadomości) wynik działania: **${num1} + ${num2} = ?**\nMasz na to 2 minuty.`)
      .setColor('Green');

    await interaction.reply({ embeds: [embed], ephemeral: true });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: 1 });

    collector.on('collect', async m => {
      await m.delete().catch(() => {});
      const userAns = parseInt(m.content.trim());
      const correctAnswer = activeCaptchas.get(interaction.user.id);

      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) return;

      if (userAns === correctAnswer) {
        activeCaptchas.delete(interaction.user.id);

        await member.roles.remove(ROLE_REMOVE_ID).catch(console.error);
        await member.roles.add(ROLE_ADD_ID).catch(console.error);

        await interaction.followUp({ content: '✅ Pomyślnie zweryfikowano! Otrzymałeś dostęp do serwera.', ephemeral: true });
      } else {
        await interaction.followUp({ content: '❌ Błędny wynik! Kliknij przycisk weryfikacji ponownie, aby spróbować.', ephemeral: true });
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
