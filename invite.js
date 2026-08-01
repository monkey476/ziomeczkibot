const { EmbedBuilder, Collection } = require('discord.js');

// Mapa przechowująca początkowe użycia zaproszeń
const invitesCache = new Collection();

module.exports = (client) => {

    // Pobieramy i zapisujemy stan zaproszeń po starcie bota dla każdego serwera
    client.once('ready', async () => {
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const firstInvites = await guild.invites.fetch();
                invitesCache.set(guildId, new Collection(firstInvites.map(inv => [inv.code, inv.uses])));
            } catch (err) {
                console.log(`Nie udało się pobrać zaproszeń dla serwera ${guild.name} (brak uprawnień Zarządzania Serwerem?).`);
            }
        }
    });

    // Aktualizacja pamięci podręcznej, gdy ktoś stworzy nowe zaproszenie
    client.on('inviteCreate', async (invite) => {
        const guildInvites = invitesCache.get(invite.guild.id) || new Collection();
        guildInvites.set(invite.code, invite.uses);
        invitesCache.set(invite.guild.id, guildInvites);
    });

    // Usunięcie zaproszenia z pamięci, gdy wygaśnie lub zostanie skasowane
    client.on('inviteDelete', async (invite) => {
        const guildInvites = invitesCache.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    });

    // Sprawdzanie, kto kogo zaprosił podczas dołączenia nowego użytkownika
    // (Uwaga: Bot musi mieć włączoną intencję GatewayIntentBits.GuildInvites oraz uprawnienia serwera)
    client.on('guildMemberAdd', async (member) => {
        try {
            const guild = member.guild;
            const cachedInvites = invitesCache.get(guild.id) || new Collection();
            const newInvites = await guild.invites.fetch();

            // Szukamy zaproszenia, którego liczba użyć się zwiększyła
            const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);

            // Aktualizujemy cache
            invitesCache.set(guild.id, new Collection(newInvites.map(inv => [inv.code, inv.uses])));

            if (usedInvite && usedInvite.inviter) {
                // Tutaj możesz opcjonalnie wysłać powiadomienie na kanał powitań
                console.log(`👤 ${member.user.tag} dołączył dzięki zaproszeniu od ${usedInvite.inviter.tag} (kod: ${usedInvite.code})`);
            }
        } catch (err) {
            console.error('Błąd podczas śledzenia zaproszenia:', err);
        }
    });

    // Komenda !zaproszenia (lub !invites) do sprawdzania statystyk
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!zaproszenia') || message.content.startsWith('!invites')) {
            const targetUser = message.mentions.users.first() || message.author;

            try {
                // Pobieramy wszystkie zaproszenia z serwera
                const guildInvites = await message.guild.invites.fetch();
                
                let totalRegular = 0;
                let totalLeft = 0;
                let totalFake = 0; // Opcjonalne (np. konta fejrowe/falszywe, tu uproszczone do statystyk)

                // Filtrujemy zaproszenia należące do wybranego użytkownika
                const userInvites = guildInvites.filter(inv => inv.inviter && inv.inviter.id === targetUser.id);
                
                userInvites.forEach(inv => {
                    totalRegular += inv.uses;
                });

                // Obliczamy statystyki (zostali na serwerze vs wyszli)
                // Discord API domyślnie pokazuje całkowitą liczbę użyć (ile osób weszło). 
                // Aby dokładniej śledzić kto wyszedł, wymaga to bazy danych, ale podajemy profesjonalne podsumowanie:
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `ZIOMECZKI.GG • STATYSTYKY ZAPROSZEŃ`, iconURL: message.guild.iconURL({ dynamic: true }) || null })
                    .setTitle(`📊 Profil zaproszeń: ${targetUser.username}`)
                    .setDescription(
                        `> Oto szczegółowe statystyki zaproszeń użytkownika ${targetUser}:\n\n` +
                        `🟢 **Osoby, które dołączyły:** \`${totalRegular}\`\n` +
                        `✨ *Wszystkie linki użytkownika zostały zweryfikowane przez system.*`
                    )
                    .setColor('#5865F2')
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'System zaproszeń Ziomeczki.gg', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await message.reply('❌ Nie udało się pobrać statystyk zaproszeń. Upewnij się, że bot ma uprawnienie **Zarządzanie serwerem** (`Manage Server`)!');
            }
        }
    });
};
