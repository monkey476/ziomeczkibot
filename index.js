const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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

const activeCaptchas = new Map();

client.on('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot gotowy do pracy.`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Komenda weryfikacji
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
    const number = parseInt(message.content.trim());
    
    // Jeśli to nie liczba albo zawiera dodatkowy tekst -> usuń
    if (isNaN(number) || message.content.trim() !== number.toString()) {
      await message.delete().catch(() => {});
      return;
    }

    // Jeśli to zła kolejność (np. po 1 napisał 5) -> usuń wiadomość i daj reakcję
    if (number !== currentCount + 1) {
      await message.delete().catch(() => {});
      // Opcjonalnie wysłanie tymczasowej reakcji/wiadomości niemożliwe po usunięciu, 
      // ale bot może wysłać i szybko usunąć powiadomienie lub po prostu usunąć błąd.
      return;
    }

    // Jeśli ta sama osoba pisze pod rząd -> usuń wiadomość
    if (message.author.id === lastUserId) {
      await message.delete().catch(() => {});
      return;
    }

    // Poprawna liczba
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
