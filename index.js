const { 
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  EmbedBuilder, ChannelType, PermissionsBitField, ModalBuilder, 
  TextInputBuilder, TextInputStyle, AttachmentBuilder 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Serwer HTTP dla Render.com + auto-ping
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Ziomeczki.gg działa!'));
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

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

// --- KONFIGURACJA GŁÓWNA ---
const VERIFY_CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

const COUNTING_CHANNEL_ID = '1532453185413972038';
const GIVEAWAY_CHANNEL_ID = '1532418596159095105';
const LAST_LETTER_CHANNEL_ID = '1532694623993200730';
const REPORT_CHANNEL_ID = '1532723262390272080';

const CREATE_VOICE_CHANNEL_ID = '1532548526825803878'; 
const VOICE_CATEGORY_ID = '1532550008833048796';

const PROTECTED_USER_ID = '1463274528930009332';

// --- NOWA KONFIGURACJA TICKETÓW (TWOJE ID) ---
const TICKET_CATEGORY_ID = '1532828546639069376';
const TICKET_LOG_CHANNEL_ID = '1532832889773883412';
const STAFF_ROLE_IDS = [
  '1532410985141243964',
  '1532411058994806824',
  '1532411123259670800',
  '1532411223457661000'
];

// Zmienne gier
let currentCount = 0;
let lastUserId = null;
let lastWord = null;
let lastLetterUserId = null;

// Auto-role
const CONFIG_FILE = path.join(__dirname, 'autorole.json');
let autoRoles = [];
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    autoRoles = data.roles || (data.roleId ? [data.roleId] : []);
  } catch (e) {}
}

// Zaproszenia
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

// Pamięć podręczna
const activeCaptchas = new Map();
const giveawayParticipants = new Map(); 
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

// --- EVENTY: ZAPROSZENIA I AUTOROLE ---
client.on('guildMemberAdd', async member => {
  if (autoRoles.length > 0) {
    for (const roleId of autoRoles) await member.roles.add(roleId).catch(() => {});
  }
  try {
    const guildInvites = await member.guild.invites.fetch();
    const cachedInvites = invitesCache.get(member.guild.id);
    let usedInvite = null;
    if (cachedInvites) {
      for (const inv of guildInvites.values()) {
        if (inv.uses > (cachedInvites.get(inv.code) || 0)) { usedInvite = inv; break; }
      }
    }
    invitesCache.set(member.guild.id, new Map(guildInvites.map(inv => [inv.code, inv.uses])));

    if (usedInvite && usedInvite.inviter) {
      let stats = userInvites.get(usedInvite.inviter.id) || { total: 0, left: 0, current: 0 };
      stats.total += 1;
      stats.current += 1;
      userInvites.set(usedInvite.inviter.id, stats);
      saveInvites();
    }
  } catch (err) {}
});

// --- OBSŁUGA KANAŁÓW GŁOSOWYCH ---
client.on('voiceStateUpdate', async (oldState, newState) => {
  const member = newState.member;
  if (!member || member.user.bot) return;

  if (newState.channelId === CREATE_VOICE_CHANNEL_ID) {
    try {
      const channel = await newState.guild.channels.create({
        name: `🎙️ ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: VOICE_CATEGORY_ID,
        permissionOverwrites: [
          { id: newState.guild.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] },
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

// --- KOMENDY ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // ANTY-PING
  if (message.mentions.users.has(PROTECTED_USER_ID)) {
    await message.delete().catch(() => {});
    try {
      await message.member.timeout(10 * 60 * 1000, 'Oznaczanie chronionego użytkownika');
      const warning = await message.channel.send(`⚠️ <@${message.author.id}>, timeout na 10 minut.`);
      setTimeout(() => warning.delete().catch(() => {}), 7000);
    } catch (err) {}
    return;
  }

  // SETUP TICKETÓW
  if (message.content === '!setup-ticket' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Centrum Pomocy')
      .setDescription('Potrzebujesz pomocy administracji? Masz ważne pytanie lub chcesz coś zgłosić?\n\nKliknij przycisk poniżej, aby stworzyć **prywatny bilet (ticket)**.')
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Stwórz Ticket')
        .setEmoji('📩')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    return;
  }

  // INNE KOMENDY (zminimalizowane objętościowo, ale w pełni działające)
  if (message.content.startsWith('!autorole')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
    const args = message.content.split(' ').slice(1);
    const action = args[0];
    const targetValue = args[1]?.replace(/[<@&>]/g, '');

    if (action === 'add' && targetValue) {
      if (!autoRoles.includes(targetValue)) {
        autoRoles.push(targetValue);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));
      }
      return message.reply(`✅ Dodano auto-rolę!`);
    }
    if (action === 'remove') {
      if (targetValue === 'all') autoRoles = [];
      else autoRoles = autoRoles.filter(id => id !== targetValue);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ roles: autoRoles }, null, 2));
      return message.reply('✅ Usunięto!');
    }
  }

  // System liczenia i liter
  if (message.channel.id === COUNTING_CHANNEL_ID) {
    const number = parseInt(message.content.trim());
    if (isNaN(number) || message.content.trim() !== number.toString() || number !== currentCount + 1 || message.author.id === lastUserId) return message.delete().catch(() => {});
    currentCount = number; lastUserId = message.author.id;
    return message.react('✅').catch(() => {});
  }
  if (message.channel.id === LAST_LETTER_CHANNEL_ID) {
    const content = message.content.trim().toLowerCase();
    if (/\d/.test(content) || content.includes(' ') || message.author.id === lastLetterUserId) return message.delete().catch(() => {});
    if (lastWord && content.charAt(0) !== lastWord.slice(-1)) return message.delete().catch(() => {});
    lastWord = content; lastLetterUserId = message.author.id;
    return message.react('✅').catch(() => {});
  }
});

// --- OBSŁUGA INTERAKCJI (PRZYCISKI I MODALE) ---
client.on('interactionCreate', async interaction => {
  // 1. TWORZENIE TICKETA - FORMULARZ
  if (interaction.isButton() && interaction.customId === 'ticket_create') {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Formularz Zgłoszeniowy');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Czego dotyczy sprawa?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Np. Pytanie o rekrutację, Zgłoszenie gracza')
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('ticket_desc')
      .setLabel('Opisz dokładnie swój problem')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Podaj jak najwięcej szczegółów...')
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(descInput));
    await interaction.showModal(modal);
    return;
  }

  // 2. TWORZENIE KANAŁU TICKETA PO WYSŁANIU FORMULARZA
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_desc');

    await interaction.reply({ content: '⏳ Trwa tworzenie Twojego ticketa...', ephemeral: true });

    try {
      // Budowanie uprawnień dla kanału (Zgłaszający + Wszystkie role administracyjne)
      const permissions = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Wszyscy niewidzą
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] } // Widzi autor
      ];

      // Dodawanie każdej roli administracyjnej do uprawnień kanału
      STAFF_ROLE_IDS.forEach(roleId => {
        permissions.push({
          id: roleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
      });

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: permissions
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket: ${subject}`)
        .setDescription(`Witaj <@${interaction.user.id}>! Administracja wkrótce się Tobą zajmie.\n\n**Opis zgłoszenia:**\n${description}`)
        .setColor('Yellow')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Zamknij i Zapisz Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      // Pingowanie wszystkich ról na raz
      const staffPings = STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(' ');
      await ticketChannel.send({ content: `<@${interaction.user.id}> | ${staffPings}`, embeds: [embed], components: [row] });
      
      await interaction.editReply({ content: `✅ Twój ticket został utworzony: <#${ticketChannel.id}>` });
    } catch (err) {
      console.error('Błąd tworzenia ticketa:', err);
      await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia ticketa. Sprawdź, czy bot ma uprawnienia Zarządzanie Kanałami i Rolami.' });
    }
    return;
  }

  // 3. ZAMYKANIE TICKETA I TRANSKRYPCJA
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    // Sprawdza czy użytkownik ma chociaż jedną z uprawnionych ról
    const hasAdminRole = STAFF_ROLE_IDS.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasAdminRole && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: '❌ Tylko administracja może zamknąć ticket.', ephemeral: true });
    }

    await interaction.reply('🔒 Zamykanie ticketa, generowanie logów...');

    try {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const transcriptData = messages.reverse().map(m => {
        const time = new Date(m.createdTimestamp).toLocaleString('pl-PL');
        return `[${time}] ${m.author.tag}: ${m.content}`;
      }).join('\n');

      const transcriptBuffer = Buffer.from(transcriptData, 'utf-8');
      const attachment = new AttachmentBuilder(transcriptBuffer, { name: `${interaction.channel.name}-transcript.txt` });

      const logChannel = await interaction.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🗃️ Zarchiwizowano Ticket')
          .addFields(
            { name: 'Zamknięty przez', value: `${interaction.user.tag}` },
            { name: 'Nazwa kanału', value: interaction.channel.name }
          )
          .setColor('Red')
          .setTimestamp();
          
        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
      }

      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('Błąd podczas zamykania ticketa:', err);
      interaction.editReply('❌ Nie udało się poprawnie zapisać ticketa.');
    }
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
