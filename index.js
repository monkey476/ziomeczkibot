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

// --- KONFIGURACJA TICKETÓW ---
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

  // --- KOMENDA KONKURSU Z WSPARCIEM DLA DAT (DD.MM.YYYY HH:MM) ---
  if (message.content.startsWith('!konkurs') && message.channel.id === GIVEAWAY_CHANNEL_ID) {
    const args = message.content.slice(8).trim().split(' ');
    
    let timeMs = 0;
    let prize = '';

    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const timeRegex = /^(\d{2}):(\d{2})$/;

    // SPRAWDZENIE CZY PODANO DATĘ W FORMACIE: DD.MM.YYYY HH:MM
    if (args.length >= 3 && dateRegex.test(args[0]) && timeRegex.test(args[1])) {
      const dateMatch = args[0].match(dateRegex);
      const timeMatch = args[1].match(timeRegex);

      const day = dateMatch[1];
      const month = dateMatch[2];
      const year = dateMatch[3];
      const hour = timeMatch[1];
      const minute = timeMatch[2];

      // Tworzenie daty (+02:00 dla czasu polskiego)
      const targetDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+02:00`);

      if (isNaN(targetDate.getTime())) {
        return message.reply('❌ Podano nieprawidłową datę!');
      }

      timeMs = targetDate.getTime() - Date.now();
      prize = args.slice(2).join(' ');
    } 
    // JEŚLI NIE DATA, TO MOŻE MINUTY?
    else {
      const minutes = parseInt(args[0]);
      if (!isNaN(minutes)) {
        timeMs = minutes * 60 * 1000;
        prize = args.slice(1).join(' ');
      }
    }

    // Walidacja błędów (brak nagrody lub zły format)
    if (!prize || timeMs === 0) {
      const errReply = await message.reply('❌ Błędny format!\nUżyj: `!konkurs [minuty] [nagroda]` LUB `!konkurs [DD.MM.YYYY] [HH:MM] [nagroda]`\nNp: `!konkurs 01.08.2026 15:00 Gra XYZ`');
      setTimeout(() => errReply.delete().catch(() => {}), 10000);
      await message.delete().catch(() => {});
      return;
    }

    if (timeMs <= 0) {
      const errReply = await message.reply('❌ Podana data jest w przeszłości! Zmień na przyszłą datę.');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      return;
    }

    if (timeMs > 2147483647) {
      const errReply = await message.reply('❌ Maksymalny czas trwania konkursu to około 24 dni (ograniczenie systemu).');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      return;
    }

    await message.delete().catch(() => {});

    const endTime = Math.floor((Date.now() + timeMs) / 1000);

    const embed = new EmbedBuilder()
      .setAuthor({ name: '🎊 NOWY KONKURS! 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
      .setTitle(`🎁 Do wygrania: **${prize}**`)
      .setDescription(
        `\n` +
        `> ⏳ **Koniec:** <t:${endTime}:R> (<t:${endTime}:t>)\n` +
        `> 👑 **Host:** ${message.author}\n` +
        `> 👥 **Uczestnicy:** \`0\`\n\n` +
        `👇 *Kliknij zielony przycisk poniżej, aby wziąć udział!*`
      )
      .setColor('#FFD700') // Złoty kolor
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Powodzenia!', iconURL: client.user.displayAvatarURL() })
      .setTimestamp(endTime * 1000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_giveaway')
        .setLabel('Weź udział')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎉')
    );

    const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
    giveawayParticipants.set(giveawayMsg.id, new Set());

    // Finał konkursu
    setTimeout(async () => {
      const participantsSet = giveawayParticipants.get(giveawayMsg.id);
      const participants = Array.from(participantsSet || []);

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('join_giveaway')
          .setLabel('Konkurs zakończony')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛑')
          .setDisabled(true)
      );

      const endedEmbed = new EmbedBuilder()
        .setAuthor({ name: '🎊 KONKURS ZAKOŃCZONY 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
        .setTitle(`🎁 Nagroda: **${prize}**`)
        .setColor('#2B2D31')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Zakończono' })
        .setTimestamp();

      if (participants.length === 0) {
        endedEmbed.setDescription(`\n> 👑 **Host:** ${message.author}\n> 👥 **Uczestnicy:** \`0\`\n\n❌ **Nikt nie wziął udziału w konkursie!**`);
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
        await message.channel.send(`❌ Konkurs o **${prize}** zakończony, ale nikt nie wziął udziału!`);
      } else {
        const winnerId = participants[Math.floor(Math.random() * participants.length)];
        endedEmbed.setDescription(`\n> 👑 **Host:** ${message.author}\n> 👥 **Uczestnicy:** \`${participants.length}\`\n\n🏆 **ZWYCIĘZCA:** <@${winnerId}>`);
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
        await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**! 🏆 Zgłoś się do hosta po odbiór nagrody.`);
      }

      giveawayParticipants.delete(giveawayMsg.id);
    }, timeMs);

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

  // AUTO-ROLE
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

  // GRY SERWEROWE
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
  
  // TWORZENIE TICKETA - FORMULARZ
  if (interaction.isButton() && interaction.customId === 'ticket_create') {
    const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('Formularz Zgłoszeniowy');
    const subjectInput = new TextInputBuilder().setCustomId('ticket_subject').setLabel('Czego dotyczy sprawa?').setStyle(TextInputStyle.Short).setPlaceholder('Np. Pytanie o rekrutację').setRequired(true).setMaxLength(50);
    const descInput = new TextInputBuilder().setCustomId('ticket_desc').setLabel('Opisz dokładnie swój problem').setStyle(TextInputStyle.Paragraph).setPlaceholder('Szczegóły...').setRequired(true).setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(descInput));
    await interaction.showModal(modal);
    return;
  }

  // TWORZENIE KANAŁU TICKETA PO WYSŁANIU FORMULARZA
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_desc');
    await interaction.reply({ content: '⏳ Trwa tworzenie Twojego ticketa...', ephemeral: true });

    try {
      const permissions = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ];

      STAFF_ROLE_IDS.forEach(roleId => {
        permissions.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
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

      Ponieważ nie podałeś w poprzedniej wiadomości, w jakim języku lub programie piszesz swój projekt, przygotowałem rozwiązania dla najpopularniejszych technologii. Wybierz to, które pasuje do Twojego kodu.

Oto jak możesz pobrać datę w formacie **DD.MM.YYYY HH:MM** (np. `01.08.2026 15:00`) i poprawnie ją obsłużyć:

## 1. Rozwiązanie w HTML i JavaScript (Strona WWW)

Możesz użyć zwykłego pola tekstowego z odpowiednim wyrażeniem regularnym, aby wymusić format `DD.MM.YYYY HH:MM`, a następnie zamienić wpisany tekst na rzeczywisty obiekt daty w JavaScript.

```html
<label for="dateInput">Wpisz datę:</label>
<input type="text" id="dateInput" placeholder="01.08.2026 15:00">
<button onclick="parseDate()">Zatwierdź</button>

<script>
function parseDate() {
    const input = document.getElementById('dateInput').value;
    // Sprawdzanie, czy wpisany tekst pasuje do wzoru DD.MM.YYYY HH:MM
    const regex = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/;
    const match = input.match(regex);

    if (match) {
        // Wyciąganie poszczególnych elementów daty
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Miesiące w JS są liczone od 0
        const year = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);

        // Tworzenie obiektu daty
        const userDate = new Date(year, month, day, hour, minute);
        
        console.log("Stworzono obiekt daty:", userDate);
        alert("Pomyślnie wczytano datę: " + userDate.toLocaleString());
    } else {
        alert("Błędny format! Użyj: DD.MM.YYYY HH:MM (np. 01.08.2026 15:00)");
    }
}
</script>
