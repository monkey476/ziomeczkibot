require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');

// --- 1. SERWER HTTP (ŻEBY RENDER NIE WYWALAŁ BŁĘDU) ---
const app = express();
app.get('/', (req, res) => res.send('Bot działa i nasłuchuje!'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serwer HTTP nasłuchuje na porcie ${port}`));

// --- 2. KONFIGURACJA BOTA ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 3. CO SIĘ DZIEJE PO WŁĄCZENIU ---
client.once('ready', () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const https = require('https');

// Tworzenie instancji bota ze wszystkimi potrzebnymi uprawnieniami
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

// --- PROSTY SERWER WWW DLA HOSTINGU ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot FAZEMC.PL dziala 24/7 i jest aktywny!\n');
});

server.listen(3000, () => {
    console.log('🌐 Serwer WWW dla utrzymania aktywności ruszył na porcie 3000.');

    // --- WBUDOWANY SYSTEM ANTI-SLEEP (DLA RENDERA) ---
    // Bot sam będzie "odwiedzał" swoją własną stronę co 10 minut, by zapobiec uśpieniu.
    setInterval(() => {
        // Render automatycznie podstawia Twój publiczny link. Jeśli go nie ma, użyje localhost.
        const url = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        console.log(`[Anti-Sleep] Wysyłam ping do: ${url}`);

        if (url.startsWith('https')) {
            https.get(url, (res) => {
                console.log(`[Anti-Sleep] Sukces! Status HTTP: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('[Anti-Sleep] Błąd pingowania (https):', err.message);
            });
        } else {
            http.get(url, (res) => {
                console.log(`[Anti-Sleep] Sukces! Status HTTP: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('[Anti-Sleep] Błąd pingowania (http):', err.message);
            });
        }
    }, 10 * 60 * 1000); // 10 minut (10 * 60 * 1000 milisekund)
});

// --- URUCHOMIENIE BOTA I WSZYSTKICH MODUŁÓW ---
client.once('ready', () => {
    console.log(`✅ Zalogowano pomyślnie jako: ${client.user.tag}`);

    // Ładowanie wszystkich systemów bota
    // ODKOMENTUJ TE LINIJKI (usuń //), GDY STWORZYSZ JUŻ TE PLIKI!
     require('./konkurs.js')(client);
     require('./report.js')(client);
     require('./weryfikacja.js')(client);
     require('./tickety.js')(client);
     require('./liczenie.js')(client);
     require('./ostatnia-litera.js')(client);
     require('./invite.js')(client);
     require('./lobby.js')(client);
     require('./musica.js')(client);
     require('./role.js')(client);
     require('./info.js')(client);
     require('./funkcje.js')(client);
});

// --- DODATKOWA KOMENDA: !wyjdz ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!wyjdz') {
        // Zabezpieczenie na Administratora
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Tylko administrator może użyć tej komendy!');
        }

        await message.reply('Naura! Wychodzę z tego serwera.');
        try {
            await message.guild.leave();
            console.log(`Bot opuścił serwer: ${message.guild.name}`);
        } catch (error) {
            console.error('Błąd podczas próby wyjścia z serwera:', error);
            message.reply('Wystąpił błąd podczas próby wyjścia.');
        }
    }
});

// Logowanie za pomocą zmiennej środowiskowej DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
        client.user.setPresence({
            activities: [{ 
                name: 'FAZEMC.PL', 
                type: ActivityType.Playing 
            }],
            status: 'online'
        });
    };

    updateStatus();
    setInterval(updateStatus, 1000 * 60 * 60); 
});

// --- 4. KOMENDY BOTA ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Testowy Ping
    if (message.content === '!ping') {
        message.reply('Pong!');
    }

    // Komenda do wychodzenia z serwera
    if (message.content === '!wyjdz') {
        // Sprawdza, czy osoba używająca komendy ma Administratora
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('Tylko administrator może użyć tej komendy!');
        }

        await message.reply('Naura! Wychodzę z tego serwera.');
        
        try {
            await message.guild.leave();
            console.log(`Bot opuścił serwer: ${message.guild.name}`);
        } catch (error) {
            console.error('Błąd podczas próby wyjścia z serwera:', error);
            message.reply('Wystąpił błąd podczas próby wyjścia.');
        }
    }
});

// --- 5. LOGOWANIE DO DISCORDA ---
// Zmienione na DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
