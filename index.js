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

    const updateStatus = () => {
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
