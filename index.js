const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 1. SERWER HTTP DLA RENDERA ---
// Render wymaga, aby aplikacja nasłuchiwała na porcie, inaczej ją wyłączy.
const app = express();

app.get('/', (req, res) => {
    res.send('Bot BroBox.pl jest online i działa poprawnie!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serwer HTTP dla Rendera uruchomiony na porcie ${port}`);
});

// --- 2. KONFIGURACJA BOTA DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// --- 3. ŁADOWANIE MODUŁÓW BROBOX.PL ---
require('./powitalnia.js')(client);
require('./weryfikacja.js')(client);
require('./tickety.js')(client);
require('./moderacja.js')(client);
require('./embedy.js')(client);

client.login(process.env.TOKEN || DISCORD_TOKEN);
