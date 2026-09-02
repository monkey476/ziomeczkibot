const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 1. SERWER EXPRESS (Wymagany przez Render do zaliczenia Deployu) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Status: 200 OK. Bot działa i nasłuchuje!');
});

app.listen(port, () => {
    console.log(`[System] Serwer HTTP uruchomiony na porcie ${port}`);
});

// --- 2. KLIENT DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`✅ Połączono z Discordem! Zalogowano jako: ${client.user.tag}`);
});

// --- 3. PODPINANIE TWOICH MODUŁÓW ---
// Upewnij się, że masz te pliki w głównym folderze!
try {
    require('./propozycje.js')(client);
    console.log('✅ Moduł: Propozycje załadowany.');
    
     require('./tickety.js')(client);
     require('./embedy.js')(client);
     require('./powitalnia.js')(client);
     require('./weryfikacja.js')(client);
     require('./moderacja.js')(client);
} catch (error) {
    console.error('❌ Wystąpił błąd podczas ładowania modułów:', error);
}

// --- 4. LOGOWANIE ---
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Błąd logowania do Discorda. Sprawdź zmienną TOKEN w panelu Render.', err);
});
