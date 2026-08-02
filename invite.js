const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ścieżka do bazy danych
const dbPath = path.join(__dirname, 'invites_data.json');

// Bezpieczne wczytywanie bazy
function loadData() {
    try {
        if (!fs.existsSync(dbPath)) {
            const initialData = { users: {}, invitedBy: {} };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        return { users: {}, invitedBy: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Pamięć RAM do śledzenia użycia zaproszeń w locie
const invitesCache = new Map();

module.exports = (client) => {

    // 1. ZAPISYWANIE STANU ZAPROSZEŃ PRZY STARCIE
    client.once('ready', async () => {
        setTimeout(async () => {
            client.guilds.cache.forEach(async (guild) => {
                try {
                    const firstInvites = await guild.invites.fetch();
                    invitesCache.set(guild.id, new Map(firstInvites.map(inv => [inv.code, inv.uses])));
                } catch (err) {
                    console.log(`[Invite System] Błąd pobierania zaproszeń na serwerze ${guild.name}. Upewnij się, że bot ma uprawnienie "Zarządzanie Serwerem"!`);
                }
            });
        }, 3000);
    });

    // 2. AKTUALIZACJA CACHE PRZY NOWYCH LINKACH
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

    // 3. ŚLEDZENIE WEJŚĆ (Kto kogo zaprosił)
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;
        const guild = member.guild;

        try {
            const newInvites = await guild.invites.fetch();
            const oldInvites = invitesCache.get(guild.id) || new Map();
            
            // Szukamy zaproszenia, któremu zwiększyła się liczba użyć
            let usedInvite = newInvites.find(inv => {
                const oldUses = oldInvites.get(inv.code) || 0;
                return inv.uses > oldUses;
            });

            // Aktualizujemy cache
            invitesCache.set(guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

            const db = loadData();

            if (usedInvite && usedInvite.inviter) {
                const inviterId = usedInvite.inviter.id;

                // Zapisujemy, kto zaprosił tego użytkownika
                db.invitedBy[member.id] = inviterId;

                // Inicjalizujemy statystyki zapraszającego, jeśli nie istnieją
                if (!db.users[inviterId]) {
                    db.users[inviterId] = { joins: 0, leaves: 0 };
                }

                db.users[inviterId].joins += 1;
                saveData(db);
            }
        } catch (err) {
            console.error('[Invite System] Błąd podczas analizy wejścia gracza:', err);
        }
    });

    // 4. ŚLEDZENIE WYJŚĆ (Ktoś wyszedł -> aktualizujemy statystyki zapraszającego)
    client.on('guildMemberRemove', async (member) => {
        const db = loadData();
        
        // Sprawdzamy, czy wiemy kto zaprosił osobę, która wyszła
        if (db.invitedBy[member.id]) {
            const inviterId = db.invitedBy[member.id];

            if (!db.users[inviterId]) {
                db.users[inviterId] = { joins: 0, leaves: 0 };
            }

            db.users[inviterId].leaves += 1;
            saveData(db);
        }
    });

    // 5. KOMENDA !invite <gracz>
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!invite') || message.content.startsWith('!zaproszenia')) {
            const args = message.content.split(' ');
            let targetUser = message.author;
            
            if (args[1]) {
                const targetId = args[1].replace(/[<@!>]/g, '');
                try {
                    const fetchedUser = await client.users.fetch(targetId);
                    if (fetchedUser) targetUser = fetchedUser;
                } catch (e) {
                    return message.reply({ content: '❌ Nie znalazłem takiego gracza. Podaj poprawne ID lub oznacz go @wzmianką.' });
                }
            }

            const db = loadData();
            
            // Pobieramy statystyki użytkownika z bazy
            let userStats = db.users[targetUser.id] ? { ...db.users[targetUser.id] } : { joins: 0, leaves: 0 };

            // Dodatkowe sprawdzenie API Discorda (jeśli gracz ma 0 w bazie, sprawdzamy aktywne linki)
            try {
                const guildInvites = await message.guild.invites.fetch();
                let apiJoins = 0;
                guildInvites.forEach(inv => {
                    if (inv.inviter && inv.inviter.id === targetUser.id) {
                        apiJoins += inv.uses;
                    }
                });
                // Jeśli z API wychodzi więcej (np. statystyki sprzed uruchomienia bota), uwzględniamy je
                if (apiJoins > userStats.joins) {
                    userStats.joins = apiJoins;
                }
            } catch (e) {
                // Ignorujemy brak uprawnień do inviteów
            }

            const totalJoins = userStats.joins;
            const totalLeaves = userStats.leaves;
            let currentActive = totalJoins - totalLeaves;
            if (currentActive < 0) currentActive = 0;

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Side Community Ziomeczki.gg • Statystyki`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .setTitle(`📊 Zaproszenia użytkownika: ${targetUser.username}`)
                .setColor('#5865F2')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '📥 Weszło', value: `> \`${totalJoins} osób\``, inline: true },
                    { name: '📤 Wyszło', value: `> \`${totalLeaves} osób\``, inline: true },
                    { name: '✅ Aktualnie na serwerze', value: `> **\`${currentActive} osób\`**`, inline: false }
                )
                .setFooter({ text: 'System zaproszeń Side Community Ziomeczki.gg', iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    });
};
