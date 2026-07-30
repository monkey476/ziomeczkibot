const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');

// 1. Serwer HTTP dla Render.com + auto-ping (zapobiega uśpieniu bota po 15 minutach)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Ziomeczki.gg działa!'));
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

// Samopinging (co 10 minut bot "odwiedza" samego siebie, żeby Render go nie uśpił)
setInterval(() => {
  if (process.env.RENDER_EXTERNAL_URL) {
    fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }
}, 10 * 60 * 1000);

// Inicjalizacja bota
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// Konfiguracja ID kanałów i ról
const VERIFY_CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

const COUNTING_CHANNEL_ID = '1532453185413972038';
let currentCount = 0;
let lastUserId = null;

// Słownik aktywnych zadań weryfikacyjnych (pytania matematyczne)
const activeCaptchas = new Map();

client.on('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);
});

// --- SYSTEM WERYFIKACJI (MATEMATYCZNY CAPTCHA) ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Komenda wysyłająca panel weryfikacji
  if (message.content === '!setup-weryfikacja' && message.channel.id === VERIFY_CHANNEL_ID) {
    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja Bezpieczeństwa')
      .setDescription('Kliknij poniższy przycisk, aby rozpocząć weryfikację.')
      .setColor('Blue');

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
    // Sprawdzamy czy to czysta liczba
    const number = parseInt(message.content.trim());
    
    if (isNaN(number) || message.content.trim() !== number.toString()) {
      await message.delete().catch(() => {});
      return;
    }

    // Sprawdzamy czy to kolejna liczba
    if (number !== currentCount + 1) {
      await message.react('❌').catch(() => {});
      return;
    }

    // Sprawdzamy czy ta sama osoba nie pisze pod rząd
    if (message.author.id === lastUserId) {
      await message.react('⚠️').catch(() => {});
      return;
    }

    // Zaliczenie liczby
    currentCount = number;
    lastUserId = message.author.id;
    await message.react('✅').catch(() => {});
    return;
  }
});

// Obsługa przycisku weryfikacji
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'start_captcha') {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;

    activeCaptchas.set(interaction.user.id, answer);

    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja CAPTCHA')
      .setDescription(`Napisz na tym kanale (w wiadomości) wynik działania: **${num1} + ${num2} = ?**\nMasz na to 2 minuty.`)
      .setColor('Yellow');

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Oczekiwanie na odpowiedź użytkownika na kanale
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

        // Zmiana ról
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
