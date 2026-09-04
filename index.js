const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Status: 200 OK. ZiomekBot działa i nasłuchuje!');
});

app.listen(port, () => {
    console.log(`[System] Serwer HTTP uruchomiony na porcie ${port}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

client.once('ready', () => {
    console.log(`✅ Połączono z Discordem! Zalogowano jako: ${client.user.tag}`);
});

const moduly = [
    'propozycje.js',
    'embedy.js',
    'moderacja.js',
    'powitalnia.js',
    'tickety.js',
    'weryfikacja.js'
];

console.log('--- Ładowanie modułów ---');
moduly.forEach(plik => {
    try {
        require(`./${plik}`)(client);
        console.log(`✅ Załadowano moduł: ${plik}`);
    } catch (error) {
        console.error(`❌ Błąd podczas ładowania modułu ${plik}:`, error.message);
    }
});
console.log('-------------------------');

// ANTI-SLEEP
const SERVER_URL = 'https://ziomeczkibot.onrender.com';

setInterval(() => {
    fetch(SERVER_URL)
        .then(res => console.log(`[Anti-Sleep] Ping wysłany. Status: ${res.status}`))
        .catch(err => console.error('[Anti-Sleep] Błąd pingu:', err.message));
}, 8 * 60 * 1000); // Ping co 8 minut

// LOGOWANIE BOTA
client.login(process.env.TOKEN).catch(err => {
    console.error('❌ Błąd logowania do Discorda. Sprawdź zmienną TOKEN w panelu Render.', err);
});
