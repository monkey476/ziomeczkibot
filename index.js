const { Client, GatewayIntentBits } = require('discord.js');
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
