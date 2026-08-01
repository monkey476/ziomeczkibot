const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args[0].toLowerCase();

        // Można użyć komend: !info, !userinfo lub !gracz
        if (command === '!info' || command === '!userinfo' || command === '!gracz') {
            
            // Określamy cel: wspomniany gracz, gracz po ID lub autor wiadomości
            const targetMember = message.mentions.members.first() || 
                                 message.guild.members.cache.get(args[1]) || 
                                 message.member;

            const user = targetMember.user;

            // Przygotowanie dat pod natywne, dynamiczne znaczniki czasu Discorda (Unix Timestamp)
            const joinedAt = Math.floor(targetMember.joinedTimestamp / 1000);
            const createdAt = Math.floor(user.createdTimestamp / 1000);
            const boostedAt = targetMember.premiumSinceTimestamp 
                ? `🚀 <t:${Math.floor(targetMember.premiumSinceTimestamp / 1000)}:R>` 
                : 'Brak ulepszenia';

            // Pobieranie ról (pomijamy rolę @everyone i sortujemy od najwyższej)
            const roles = targetMember.roles.cache
                .filter(r => r.id !== message.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString());
            
            // Zabezpieczenie na wypadek, gdyby ktoś miał absurdalnie dużo ról (limit Discorda to 1024 znaki w polu)
            const rolesDisplay = roles.length > 0 
                ? (roles.join(', ').length > 1024 ? 'Zbyt wiele ról do wyświetlenia (limit znaków).' : roles.join(', '))
                : 'Brak przypisanych ról';

            // Ustawiamy kolor panelu na kolor najwyższej roli gracza (lub domyślny jeśli nie ma)
            const embedColor = targetMember.displayHexColor !== '#000000' ? targetMember.displayHexColor : '#5865F2';

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Informacje o profilu: ${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setColor(embedColor)
                .addFields(
                    { name: '👤 Podstawowe', value: `> **Konto:** ${user}\n> **Nazwa:** \`${user.username}\`\n> **ID:** \`${user.id}\`\n> **Czy jest botem?** ${user.bot ? 'Tak 🤖' : 'Nie 👤'}`, inline: true },
                    { name: '📅 Historia', value: `> **Na serwerze od:** <t:${joinedAt}:D> (<t:${joinedAt}:R>)\n> **Konto stworzone:** <t:${createdAt}:D> (<t:${createdAt}:R>)`, inline: true },
                    { name: '💎 Status Ulepszenia (Server Boost)', value: `> ${boostedAt}`, inline: false },
                    { name: `🎭 Posiadane role [${roles.length}]`, value: rolesDisplay, inline: false }
                )
                .setFooter({ text: `Wywołane przez: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            // Próbujemy pobrać szczegółowe dane użytkownika z API, aby zdobyć jego baner profilowy
            try {
                const fetchedUser = await client.users.fetch(user.id, { force: true });
                if (fetchedUser.bannerURL()) {
                    embed.setImage(fetchedUser.bannerURL({ dynamic: true, size: 512 }));
                }
            } catch (error) {
                // Jeśli pobranie baneru się nie uda, ignorujemy (wiadomość i tak się wyśle ładnie)
            }

            await message.channel.send({ embeds: [embed] });
        }
    });
};
