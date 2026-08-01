const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Tworzenie instancji bota ze wszystkimi potrzebnymi uprawnieniami
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Wymagane do działania powitań i AUTOROLI!
        GatewayIntentBits.GuildInvites
    ]
});

// --- PROSTY SERWER WWW DLA HOSTINGU (Zapewnia, że bot jest cały czas aktywny 24/7) ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Ziomeczki.gg dziala 24/7 i jest aktywny!\n');
});

server.listen(3000, () => {
    console.log('🌐 Serwer WWW dla utrzymania aktywności ruszył na porcie 3000.');
});

// --- URUCHOMIENIE BOTA I WSZYSTKICH MODUŁÓW ---
client.once('ready', () => {
    console.log(`✅ Zalogowano pomyślnie jako: ${client.user.tag}`);
    
    // Ładowanie wszystkich systemów bota
    require('./konkurs.js')(client);
    require('./report.js')(client);
    require('./weryfikacja.js')(client);
    require('./tickety.js')(client);
    require('./liczenie.js')(client);
    require('./ostatnia-litera.js')(client);
    require('./invite.js')(client);
    require('./lobby.js')(client);
    require('./role.js')(client); // <--- DODANO MODUŁ AUTOROLI
});

// Logowanie za pomocą zmiennej środowiskowej DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
