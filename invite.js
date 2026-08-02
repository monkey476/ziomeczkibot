const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ścieżka do naszego pliku z bazą zaproszeń
const dbPath = path.join(__dirname, 'invites_data.json');

// Tworzymy plik JSON, jeśli jeszcze nie istnieje
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: {}, invitedBy: {} }));
}

// Funkcje pomocnicze do wczytywania i zapisywania bazy
function loadData() {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        return { users: {}, invitedBy: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Pamięć RAM bota do porównywania zaproszeń (które zaproszenie zyskało użycie)
const invitesCache = new Map();

module.exports = (client) => {

    // 1. POBIERANIE ZAPROSZEŃ PRZY STARCIE BOTA
    client.on('ready', async () => {
        setTimeout(async () => {
            client.guilds.cache.forEach(async (guild) => {
                try {
                    const firstInvites = await guild.invites.fetch();
                    invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
                } catch (err) {
                    console.log(`[Invite System] Brak uprawnienia "Zarządzanie Serwerem" na: ${guild.name}`);
                }
            });
        }, 3000); // Małe opóźnienie, by bot spokojnie się zalogował
    });

    // 2. AKTUALIZACJA PAMIĘCI PRZY TWORZENIU/USUWANIU LINKÓW
    client.on('inviteCreate', (invite) => {
        if (!invitesCache.has(invite.guild.id)) {
            invitesCache.set(invite.guild.id, new Map());
        }
        invitesCache.get(invite.guild.id).set(invite.code, invite.uses);
    });

    client.on('inviteDelete', (invite) => {
        if (invitesCache.has(invite.guild.id)) {
            invitesCache.get(invite.guild.id).delete(invite.code);
        }
    });

    // 3. OBSŁUGA WEJŚCIA GRACZA NA SERWER (Dodawanie pkt)
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return; // Ignorujemy boty
        const guild = member.guild;

        try {
            const newInvites = await guild.invites.fetch();
            const oldInvites = invitesCache.get(guild.id) || new Map();
            
            // Szukamy linku, któremu podskoczyły użycia
            const usedInvite = newInvites.find(inv => {
                const oldUses = oldInvites.get(inv.code) || 0;
                return inv.uses > oldUses;
            });

            // Aktualizujemy pamięć RAM na bieżąco
            invitesCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

            if (usedInvite && usedInvite.inviter) {
                const inviterId = usedInvite.inviter.id;
                const db = loadData();

                // Zapisujemy w historii "KTO ZAPROSIŁ KOGO"
                db.invitedBy[member.id] = inviterId;

                // Dodajemy statystyki wejść
                if (!db.users[inviterId]) db.users[inviterId] = { joins: 0, leaves: 0 };
                db.users[inviterId].joins += 1;

                saveData(db);
            }
        } catch (err) {
            console.error('[Invite System] Błąd przy wejściu gracza:', err);
        }
    });

    // 4. OBSŁUGA WYJŚCIA GRACZA (Zabieranie pkt / Wyszło)
    client.on('guildMemberRemove', async (member) => {
        const db = loadData();
        
        // Sprawdzamy czy mamy zapisanego gracza w bazie "KTO GO ZAPROSIŁ"
        if (db.invitedBy[member.id]) {
            const inviterId = db.invitedBy[member.id];

            // Nabijamy osobie zapraszającej punkt do "Wyszło"
            if (!db.users[inviterId]) db.users[inviterId] = { joins: 0, leaves: 0 };
            db.users[inviterId].leaves += 1;

            saveData(db);
        }
    });

    // 5. KOMENDA DO SPRAWDZANIA STATYSTYK: !invite <gracz>
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!invite')) {
            const args = message.content.split(' ');
            
            // Domyślnie sprawdzamy osobę piszącą komendę
            let targetUser = message.author;
            
            // Jeśli ktoś oznaczył gracza (!invite @Gracz) lub wpisał jego ID (!invite 123456789)
            if (args[1]) {
                const targetId = args[1].replace(/[<@!>]/g, ''); // Czyste wyciągnięcie ID z pingowania
                try {
                    const fetchedUser = await client.users.fetch(targetId);
                    if (fetchedUser) targetUser = fetchedUser;
                } catch (e) {
                    return message.reply({ content: '❌ Nie znalazłem takiego gracza. Upewnij się, że podałeś poprawne ID lub oznaczyłeś go poprawnie.' });
                }
            }

            // ODCZYT BAZY ZAPROSZEŃ
            const db = loadData();
            const userStats = db.users[targetUser.id] || { joins: 0, leaves: 0 };

            // OBLICZANIE "STARYCH" ZAPROSZEŃ
            // Zliczamy aktywne linki, jeśli ktoś robił zaproszenia zanim dodaliśmy bota
            const guildInvites = await message.guild.invites.fetch().catch(() => new Map());
            let baselineJoins = 0;
            guildInvites.forEach(inv => {
                if (inv.inviter && inv.inviter.id === targetUser.id) {
                    baselineJoins += inv.uses;
                }
            });

            // Ostateczna matematyka (Bot inteligentnie łączy stare zaproszenia serwera z nową bazą wyjść)
            const finalJoins = Math.max(baselineJoins, userStats.joins);
            const finalLeaves = userStats.leaves;
            let stayCount = finalJoins - finalLeaves;

            // Zabezpieczenie przed minusowym wynikiem
            if (stayCount < 0) stayCount = 0;

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Statystyki Zaproszeń`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setTitle(`📈 Sprawdzasz gracza: ${targetUser.username}`)
                .setColor('#2b2d31') // Nowoczesny ciemny kolor
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '📥 Weszło', value: `> \`${finalJoins} osób\``, inline: true },
                    { name: '📤 Wyszło', value: `> \`${finalLeaves} osób\``, inline: true },
                    { name: '✅ Aktualnie na serwerze (Ważne)', value: `> **\`${stayCount} osób\`**`, inline: false }
                )
                .setFooter({ text: 'Side Community Ziomeczki.gg • System Zaproszeń', iconURL: message.guild.iconURL({ dynamic: true }) });

            await message.reply({ embeds: [embed] });
        }
    });
};
