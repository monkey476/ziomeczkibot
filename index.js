const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

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
    GatewayIntentBits.GuildVoiceStates
  ] 
});

// Konfiguracja ID kanałów, ról oraz chronionego użytkownika
const VERIFY_CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

const COUNTING_CHANNEL_ID = '1532453185413972038';
const GIVEAWAY_CHANNEL_ID = '1532418596159095105';
const LAST_LETTER_CHANNEL_ID = '1532694623993200730'; // Nowy kanał do gry w ostatnią literę

const CREATE_VOICE_CHANNEL_ID = '1532548526825803878'; 
const VOICE_CATEGORY_ID = '1532550008833048796';

let currentCount = 0;
let lastUserId = null;

// Zmienne dla gry w ostatnią literę
let lastWord = null;
let lastLetterUserId = null;

const PROTECTED_USER_ID = '1463274528930009332';

// Plik do zapisu auto-rol
const CONFIG_FILE = path.join(__dirname, 'autorole.json');
let autoRoles = [];

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    autoRoles = data.roles || (data.roleId ? [data.roleId] : []);
  } catch (e) {}
}

const activeCaptchas = new Map();
const giveawayParticipants = new Map();
const tempVoiceChannels = new Set();

client.on('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);

  try {
    const countingChannel = await client.channels.fetch(COUNTING_CHANNEL_ID);
    if (countingChannel) {
      const messages = await countingChannel.messages.fetch({ limit: 5 });
      for (const msg of messages.values()) {
        const num = parseInt(msg.content.trim());
        if (!isNaN(msg.content.trim()) && msg.content.trim() === num.toString()) {
          currentCount = num;
          lastUserId = msg.author.id;
          console.log(`[LICZENIE] Zsynchronizowano! Ostatnia liczba to: ${currentCount}`);
          break;
        }
      }
    }
  } catch (err) {
    console.error('Nie udało się pobrać historii liczenia:', err);
  }

  // Synchronizacja ostatniego słowa z kanału "Ostatnia litera"
  try {
    const letterChannel = await client.channels.fetch(LAST_LETTER_CHANNEL_ID);
    if (letterChannel) {
      const messages = await letterChannel.messages.fetch({ limit: 5 });
      for (const msg of messages.values()) {
        const content = msg.content.trim();
        // Sprawdź czy wiadomość nie ma cyfr i składa się z jednego słowa/wyrazu
        if (content && !/\d/.test(content)) {
          lastWord = content.toLowerCase();
          lastLetterUserId = msg.author.id;
          console.log(`[OSTATNIA LITERA] Zsynchronizowano! Ostatnie słowo to: ${lastWord}`);
          break;
        }
      }
    }
  } catch (err) {
    console.error('Nie udało się pobrać historii ostatniej litery:', err);
  }
});

// --- AUTOMATYCZNE NADAWANIE RÓL PO WEJŚCIU NA SERWER ---
client.on('guildMemberAdd', async member => {
  if (autoRoles.length === 0) return;
  for (const roleId of autoRoles) {
    try {
      await member.roles.add(roleId);
      console.log(`[AUTOROLE] Nadano rolę ID ${roleId} dla użytkownika ${member.user.tag}`);
    } catch (err) {
      console.error(`Nie udało się nadać auto-roli ${roleId}:`, err);
    }
  }
});

// --- OBSŁUGA KANAŁÓW GŁOSOWYCH ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member;
  if (!member || member.user.bot) return;

  if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
    try {
      const guild = newState.guild;
      const channelName = `🎙️ Kanał - ${member.user.username}`;

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
            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers],
          }
        ]
      });

      tempVoiceChannels.add(channel.id);
      await member.voice.setChannel(channel).catch(() => {});
    } catch (err) {
      console.error('Błąd podczas tworzenia kanału głosowego:', err);
    }
  }

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

  // --- KOMENDA: !autorole add <id> / remove <id|all> ---
  if (message.content.startsWith('!autorole')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      const errReply = await message.reply('❌ Nie masz uprawnień do zarządzania rolami!');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      await message.delete().catch(() => {});
      return;
    }

    const args = message.content.split(' ').slice(1);
    const action = args[0];
    const targetValue = args[1]?.replace(/[<@&>]/g, '');

    if (action === 'add') {
      if (!targetValue) {
        const errReply = await message.reply('❌ Podaj ID roli! Użyj: `!autorole add <id_roli>`');
        setTimeout(() => errReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      const role = message.guild.roles.cache.get(targetValue);
      if (!role) {
        const errReply = await message.reply('❌ Nie znaleziono takiej roli na tym serwerze!');
        setTimeout(() => errReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      if (autoRoles.includes(targetValue)) {
        const errReply = await message.reply('⚠️ Ta rola jest już dodana do auto-rol!');
        setTimeout(() => errReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      autoRoles.push(targetValue);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));

      const successReply = await message.reply(`✅ Pomyślnie dodano auto-rolę: **${role.name}** (\`${targetValue}\`).`);
      setTimeout(() => successReply.delete().catch(() => {}), 7000);
      await message.delete().catch(() => {});
      return;
    } 
    
    if (action === 'remove') {
      if (!targetValue) {
        const errReply = await message.reply('❌ Podaj ID roli do usunięcia lub wpisz `all`! Użyj: `!autorole remove <id/all>`');
        setTimeout(() => errReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      if (targetValue.toLowerCase() === 'all') {
        autoRoles = [];
        if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);

        const successReply = await message.reply('✅ Wyczyszczono i wyłączono wszystkie auto-role.');
        setTimeout(() => successReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      if (!autoRoles.includes(targetValue)) {
        const errReply = await message.reply('❌ Tej roli nie ma na liście auto-rol.');
        setTimeout(() => errReply.delete().catch(() => {}), 5000);
        await message.delete().catch(() => {});
        return;
      }

      autoRoles = autoRoles.filter(id => id !== targetValue);
      if (autoRoles.length > 0) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));
      } else {
        if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
      }

      const successReply = await message.reply(`✅ Pomyślnie usunięto rolę o ID \`${targetValue}\` z auto-rol.`);
      setTimeout(() => successReply.delete().catch(() => {}), 5000);
      await message.delete().catch(() => {});
      return;
    }

    const rolesList = autoRoles.length > 0 ? autoRoles.map(id => `<@&${id}>`).join(', ') : 'Brak';
    const infoReply = await message.reply(`ℹ️ Aktywne auto-role: ${rolesList}\nUżycie:\n• \`!autorole add <id>\`\n• \`!autorole remove <id>\`\n• \`!autorole remove all\``);
    setTimeout(() => infoReply.delete().catch(() => {}), 9000);
    await message.delete().catch(() => {});
    return;
  }

  // --- KOMENDA: !info <gracz / id> ---
  if (message.content.startsWith('!info')) {
    const args = message.content.split(' ').slice(1);
    let target = message.mentions.members.first();

    if (!target && args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '');
      try {
        target = await message.guild.members.fetch(cleanId).catch(() => null);
      } catch (e) {}

      if (!target} {
        try {
          const fetchedMembers = await message.guild.members.fetch({ query: args.join(' '), limit: 1 });
          target = fetchedMembers.first();
        } catch (e) {}
      }
    }

    if (!target) {
      target = message.member;
    }

    const user = target.user;
    const joinedTimestamp = Math.floor(target.joinedTimestamp / 1000);
    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
    const roles = target.roles.cache.filter(r => r.id !== message.guild.id).sort((a, b) => b.position - a.position).map(r => r).join(', ') || 'Brak ról';

    const embed = new EmbedBuilder()
      .setTitle(`📊 Informacje o użytkowniku: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setColor('Green')
      .addFields(
        { name: '🆔 ID Użytkownika', value: `\`${user.id}\``, inline: true },
        { name: '👤 Nazwa / Nick', value: `${target.displayName} (${user.username})`, inline: true },
        { name: '🤖 Typ konta', value: user.bot ? 'Bot' : 'Człowiek', inline: true },
        { name: '📥 Dołączył na serwer', value: `<t:${joinedTimestamp}:F>\n(<t:${joinedTimestamp}:R>)`, inline: false },
        { name: '🎂 Założył konto Discord', value: `<t:${createdTimestamp}:F>\n(<t:${createdTimestamp}:R>)`, inline: false },
        { name: '🛡️ Najwyższa rola', value: `${target.roles.highest}`, inline: true },
        { name: '⏳ Status Timeoutu', value: target.isCommunicationDisabled() ? `Wyciszony do: <t:${Math.floor(target.communicationDisabledUntilTimestamp / 1000)}:R>` : 'Brak wyciszenia', inline: true },
        { name: '📜 Role użytkownika', value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles, inline: false }
      )
      .setFooter({ text: `Komendę wywołał: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
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

  // --- SYSTEM OSTATNIEJ LITERY ---
  if (message.channel.id === LAST_LETTER_CHANNEL_ID) {
    const content = message.content.trim().toLowerCase();

    // 1. Sprawdź czy wiadomość zawiera jakiekolwiek cyfry lub spacje (ma być jedno słowo)
    if (/\d/.test(content) || content.includes(' ')) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send(`❌ <@${message.author.id}>, w tym kanale można pisać **tylko pojedyncze słowa** (bez cyfr i spacji)!`);
      setTimeout(() => warn.delete().catch(() => {}), 4000);
      return;
    }

    // 2. Blokada pisania dwa razy pod rząd przez tę samą osobę (opcjonalne, ale zapobiega spamowi - jeśli nie chcesz, usuń ten blok)
    if (message.author.id === lastLetterUserId) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send(`❌ <@${message.author.id}>, musisz poczekać, aż ktoś inny napisze słowo!`);
      setTimeout(() => warn.delete().catch(() => {}), 4000);
      return;
    }

    // 3. Sprawdź poprawność litery, jeśli to kolejne słowo w grze
    if (lastWord) {
      const requiredLetter = lastWord.slice(-1);
      const firstLetter = content.charAt(0);

      if (firstLetter !== requiredLetter) {
        await message.delete().catch(() => {});
        const warn = await message.channel.send(`❌ <@${message.author.id}>, Twoje słowo musi zaczynać się na literę **"${requiredLetter.toUpperCase()}"** (ostatnia litera słowa "${lastWord}")!`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    // Jeśli wszystko OK
    lastWord = content;
    lastLetterUserId = message.author.id;
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
