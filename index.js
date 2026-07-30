const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Prosty serwer HTTP, żeby Render nie uśpił bota
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot Ziomeczki.gg działa!');
});

app.listen(PORT, () => {
  console.log(`Serwer HTTP uruchomiony na porcie ${PORT}`);
});

// Kod bota Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}! Bot Ziomeczki.gg działa!`);
});

client.on('messageCreate', message => {
  if (message.content === '!ping') {
    message.reply('Pong! Ziomeczki.gg żyje! 🌴');
  }
});

client.login(process.env.DISCORD_TOKEN);
