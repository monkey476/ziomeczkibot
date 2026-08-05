const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const https = require('https'); // Wymagane do pingowania linków Rendera (https)

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
    
    // --- WBUDOWANY SYSTEM ANTI-SLEEP (DLA RENDERA) ---
    // Bot sam będzie "odwiedzał" swoją własną stronę co 10 minut, by zapobiec uśpieniu.
    setInterval(() => {
        // Render automatycznie podstawia tu Twój publiczny link. Jeśli z jakiegoś powodu go nie ma, użyje localhost.
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
    require('./konkurs.js')(client);
    require('./report.js')(client); 
    require('./weryfikacja.js')(client); 
    require('./tickety.js')(client); 
    require('./liczenie.js')(client);
    require('./ostatnia-litera.js')(client);
    require('./invite.js')(client);
    require('./lobby.js')(client);
    require('./musico.js')(client);
    require('./role.js')(client);
    require('./info.js')(client);
    require('./funkcje.js')(client);
});

// Logowanie za pomocą zmiennej środowiskowej DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
