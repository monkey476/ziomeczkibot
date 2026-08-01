const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

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
    res.end('Bot Side Community Ziomeczki.gg dziala 24/7 i jest aktywny!\n');
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
    require('./role.js')(client);
    require('./info.js')(client); 
});

client.login(process.env.DISCORD_TOKEN);
