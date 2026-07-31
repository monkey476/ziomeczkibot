const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionsBitField, Collection } = require('discord.js');
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites
  ] 
});

// Konfiguracja ID kanałów, ról oraz chronionego użytkownika
const VERIFY_CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

const COUNTING_CHANNEL_ID = '1532453185413972038';
const GIVEAWAY_CHANNEL_ID = '1532418596159095105';
const LAST_LETTER_CHANNEL_ID = '1532694623993200730';
const REPORT_CHANNEL_ID = '1532723262390272080';

const CREATE_VOICE_CHANNEL_ID = '1532548526825803878'; 
const VOICE_CATEGORY_ID = '1532550008833048796';

let currentCount = 0;
let lastUserId = null;

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

// Kolekcja do śledzenia zaproszeń
const invitesCache = new Map();
const invitesFile = path.join(__dirname, 'invites.json');
let userInvites = new Map();

if (fs.existsSync(invitesFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(invitesFile, 'utf8'));
    userInvites = new Map(Object.entries(data));
  } catch (e) {}
}

function saveInvites() {
  const obj = Object.fromEntries(userInvites);
  fs.writeFileSync(invitesFile, JSON.stringify(obj, null, 2));
}

const activeCaptchas = new Map();
const giveawayParticipants = new Map(); // Przechowuje uczestników dla każdego konkursu osobno
const tempVoiceChannels = new Set();

client.on('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);

  for (const guild of client.guilds.cache.values()) {
    try {
      const firstInvites = await guild.invites.fetch();
      invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
    } catch (err) {}
  }

  try {
    const countingChannel = await client.channels.fetch(COUNTING_CHANNEL_ID);
    if (countingChannel) {
      const messages = await countingChannel.messages.fetch({ limit: 5 });
      for (const msg of messages.values()) {
        const num = parseInt(msg.content.trim());
        if (!isNaN(msg.content.trim()) && msg.content.trim() === num.toString()) {
          currentCount = num;
          lastUserId = msg.author.id;
          break;
        }
      }
    }
  } catch (err) {}

  try {
    const letterChannel = await client.channels.fetch(LAST_LETTER_CHANNEL_ID);
    if (letterChannel) {
      const messages = await letterChannel.messages.fetch({ limit: 5 });
      for (const msg of messages.values()) {
        const content = msg.content.trim();
        if (content && !/\d/.test(content)) {
          lastWord = content.toLowerCase();
          lastLetterUserId = msg.author.id;
          break;
        }
      }
    }
  } catch (err) {}
});

// --- ŚLEDZENIE ZAPROSZEŃ ---
client.on('guildMemberAdd', async member => {
  if (autoRoles.length > 0) {
    for (const roleId of autoRoles) {
      await member.roles.add(roleId).catch(() => {});
    }
  }

  try {
    const guildInvites = await member.guild.invites.fetch();
    const cachedInvites = invitesCache.get(member.guild.id);
    
    let usedInvite = null;
    if (cachedInvites) {
      for (const inv of guildInvites.values()) {
        const cachedUses = cachedInvites.get(inv.code) || 0;
        if (inv.uses > cachedUses) {
          usedInvite = inv;
          break;
        }
      }
    }

    invitesCache.set(member.guild.id, new Map(guildInvites.map(inv => [inv.code, inv.uses])));

    if (usedInvite && usedInvite.inviter) {
      const inviterId = usedInvite.inviter.id;
      let stats = userInvites.get(inviterId) || { total: 0, left: 0, current: 0 };
      
      stats.total += 1;
      stats.current += 1;
      userInvites.set(inviterId, stats);
      saveInvites();
    }
  } catch (err) {}
});

client.on('guildMemberRemove', async member => {});

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
          { id: guild.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] },
          { id: member.id, allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers] }
        ]
      });

      tempVoiceChannels.add(channel.id);
      await member.voice.setChannel(channel).catch(() => {});
    } catch (err) {}
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

  // --- ANTY-PING ---
  if (message.mentions.users.has(PROTECTED_USER_ID)) {
    await message.delete().catch(() => {});
    try {
      const member = await message.guild.members.fetch(message.author.id);
      await member.timeout(10 * 60 * 1000, 'Próba oznaczania chronionego użytkownika');
      const warning = await message.channel.send(`⚠️ <@${message.author.id}>, nie wolno oznaczać tej osoby! Timeout na 10 minut.`);
      setTimeout(() => warning.delete().catch(() => {}), 7000);
    } catch (err) {}
    return;
  }

  // --- KOMENDA: !invite ---
  if (message.content.startsWith('!invite')) {
    const args = message.content.split(' ').slice(1);
    let targetUser = message.mentions.users.first();

    if (!targetUser && args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '');
      try { targetUser = await client.users.fetch(cleanId).catch(() => null); } catch (e) {}
    }

    if (!targetUser) targetUser = message.author;

    const stats = userInvites.get(targetUser.id) || { total: 0, left: 0, current: 0 };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Statystyki zaproszeń: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor('Blue')
      .addFields(
        { name: '📥 Łącznie zaproszonych', value: `**${stats.total}** osób`, inline: true },
        { name: '✅ Obecnie na serwerze', value: `**${stats.current}** osób`, inline: true },
        { name: '❌ Wyszło z serwera', value: `**${stats.left}** osób`, inline: true }
      )
      .setFooter({ text: `Komendę wywołał: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    return;
  }

  // --- KOMENDA: !report ---
  if (message.content.startsWith('!report')) {
    const args = message.content.split(' ').slice(1);
    const targetMember = message.mentions.members.first();
    const reason = args.slice(1).join(' ');

    if (!targetMember || !reason) {
      const errReply = await message.reply(`❌ Błędny format! Użyj: \`!report @wzmianka <powód>\``);
      setTimeout(() => errReply.delete().catch(() => {}), 6000);
      return;
    }

    if (targetMember.id === message.author.id) {
      const errReply = await message.reply(`❌ Nie możesz zgłosić samego siebie!`);
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      return;
    }

    try {
      const reportChannel = await message.guild.channels.fetch(REPORT_CHANNEL_ID);
      if (!reportChannel) return;

      const reportEmbed = new EmbedBuilder()
        .setTitle('🚨 NOWE ZGŁOSZENIE (RAPORT)')
        .setColor('Red')
        .addFields(
          { name: '👤 Zgłaszający', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: false },
          { name: '🎯 Zgłoszony gracz', value: `${targetMember.user.tag} (\`${targetMember.id}\`)`, inline: false },
          { name: '📝 Powód', value: reason, inline: false },
          { name: '📍 Kanał zgłoszenia', value: `<#${message.channel.id}>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `ID Zgłoszenia: ${message.id}` });

      await reportChannel.send({ embeds: [reportEmbed] });
      const successReply = await message.reply(`✅ Twoje zgłoszenie zostało wysłane do administracji.`);
      setTimeout(() => successReply.delete().catch(() => {}), 5000);
    } catch (err) {}
    return;
  }

  // --- KOMENDA: !autorole ---
  if (message.content.startsWith('!autorole')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      const errReply = await message.reply('❌ Brak uprawnień!');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      await message.delete().catch(() => {});
      return;
    }

    const args = message.content.split(' ').slice(1);
    const action = args[0];
    const targetValue = args[1]?.replace(/[<@&>]/g, '');

    if (action === 'add') {
      if (!targetValue) return message.reply('❌ Podaj ID roli!');
      const role = message.guild.roles.cache.get(targetValue);
      if (!role) return message.reply('❌ Nie znaleziono roli!');
      
      if (!autoRoles.includes(targetValue)) {
        autoRoles.push(targetValue);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));
      }
      return message.reply(`✅ Dodano auto-rolę: **${role.name}**`);
    }
    
    if (action === 'remove') {
      if (targetValue?.toLowerCase() === 'all') {
        autoRoles = [];
        if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
        return message.reply('✅ Wyczyszczono auto-role.');
      }
      autoRoles = autoRoles.filter(id => id !== targetValue);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));
      return message.reply('✅ Usunięto rolę z auto-rol.');
    }
  }

  // --- KOMENDA: !info ---
  if (message.content.startsWith('!info')) {
    const args = message.content.split(' ').slice(1);
    let target = message.mentions.members.first();

    if (!target && args[0]) {
      const cleanId = args[0].replace(/[<@!>]/g, '');
      try { target = await message.guild.members.fetch(cleanId).catch(() => null); } catch (e) {}
    }
    if (!target) target = message.member;

    const user = target.user;
    const joinedTimestamp = Math.floor(target.joinedTimestamp / 1000);
    const roles = target.roles.cache.filter(r => r.id !== message.guild.id).sort((a, b) => b.position - a.position).map(r => r).join(', ') || 'Brak';

    const embed = new EmbedBuilder()
      .setTitle(`📊 Informacje o użytkowniku: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setColor('Green')
      .addFields(
        { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
        { name: '👤 Nick', value: target.displayName, inline: true },
        { name: '📥 Dołączył', value: `<t:${joinedTimestamp}:R>`, inline: false },
        { name: '📜 Role', value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles, inline: false }
      )
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
    return;
  }

  // --- KOMENDA KONKURSU (WIELE RÓWNOCZEŚNIE): !konkurs [minuty] [nagroda] ---
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
    
    // Tworzymy unikalny zestaw uczestników przypisany do ID tej konkretnej wiadomości konkursu
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
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
        await message.channel.send('❌ Konkurs zakończony, brak uczestników.');
      } else {
        const winnerId = participants[Math.floor(Math.random() * participants.length)];
        endedEmbed.addFields({ name: 'Zwycięzca', value: `<@${winnerId}>! Gratulacje! 🏆` });
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
        await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**!`);
      }

      // Usuwamy dane tego konkursu z pamięci po zakończeniu
      giveawayParticipants.delete(giveawayMsg.id);
    }, minutes * 60 * 1000);

    return;
  }

  // --- SYSTEM LICZENIA ---
  if (message.channel.id === COUNTING_CHANNEL_ID) {
    const number = parseInt(message.content.trim());
    if (isNaN(number) || message.content.trim() !== number.toString() || number !== currentCount + 1 || message.author.id === lastUserId) {
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
    if (/\d/.test(content) || content.includes(' ') || message.author.id === lastLetterUserId) {
      await message.delete().catch(() => {});
      return;
    }
    if (lastWord) {
      const requiredLetter = lastWord.slice(-1);
      if (content.charAt(0) !== requiredLetter) {
        await message.delete().catch(() => {});
        return;
      }
    }
    lastWord = content;
    lastLetterUserId = message.author.id;
    await message.react('✅').catch(() => {});
    return;
  }
});

// Obsługa interakcji przycisków
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
    activeCaptchas.set(interaction.user.id, num1 + num2);

    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja CAPTCHA')
      .setDescription(`Napisz na kanale wynik: **${num1} + ${num2} = ?**`)
      .setColor('Green');

    await interaction.reply({ embeds: [embed], ephemeral: true });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: 1 });

    collector.on('collect', async m => {
      await m.delete().catch(() => {});
      if (parseInt(m.content.trim()) === activeCaptchas.get(interaction.user.id)) {
        activeCaptchas.delete(interaction.user.id);
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          await member.roles.remove(ROLE_REMOVE_ID).catch(() => {});
          await member.roles.add(ROLE_ADD_ID).catch(() => {});
        }
        await interaction.followUp({ content: '✅ Zweryfikowano pomyślnie!', ephemeral: true });
      } else {
        await interaction.followUp({ content: '❌ Błędny wynik!', ephemeral: true });
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
