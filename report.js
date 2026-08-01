const { EmbedBuilder } = require('discord.js');

// --- KONFIGURACJA ZGŁOSZEŃ ---
const REPORT_CHANNEL_ID = '1532723262390272080';

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args[0].toLowerCase();

        if (command === '!report' || command === '!zglos') {
            
            // Usuwamy wiadomość użytkownika dla dyskrecji
            await message.delete().catch(() => {});

            // Sprawdzamy, czy podano kogo zgłosić
            const targetParam = args[1];
            if (!targetParam) {
                const warn = await message.channel.send(`❌ **${message.author.username}**, poprawne użycie: \`!report <@gracz/ID> <powód>\``);
                setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }

            // Szukamy zgłaszanego gracza (przez wzmiankę lub ID)
            const targetMember = message.mentions.members.first() || message.guild.members.cache.get(targetParam);
            if (!targetMember) {
                const warn = await message.channel.send(`❌ Nie mogłem znaleźć takiego gracza. Upewnij się, że podałeś poprawne ID lub oznaczenie (@).`);
                setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }

            // Sprawdzamy, czy gracz nie próbuje zgłosić samego siebie
            if (targetMember.id === message.author.id) {
                const warn = await message.channel.send(`⚠️ Nie możesz zgłosić samego siebie!`);
                setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }

            // Sprawdzamy, czy podano powód zgłoszenia (łączymy resztę słów w jedno zdanie)
            const reason = args.slice(2).join(' ');
            if (!reason) {
                const warn = await message.channel.send(`❌ **${message.author.username}**, musisz podać powód zgłoszenia! \`!report <@gracz> <powód>\``);
                setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }

            // Pobieramy kanał do zgłoszeń
            const reportChannel = message.guild.channels.cache.get(REPORT_CHANNEL_ID);
            if (!reportChannel) {
                return console.error('Błąd: Nie znaleziono kanału zgłoszeń o podanym ID!');
            }

            // Tworzymy piękny Embed dla administracji
            const reportEmbed = new EmbedBuilder()
                .setAuthor({ name: '🚨 NOWE ZGŁOSZENIE (REPORT)', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle(`Zgłoszono gracza: ${targetMember.user.tag}`)
                .setDescription(`> Prosimy administrację o jak najszybsze rozpatrzenie tej sprawy.`)
                .setColor('#E74C3C') // Czerwony kolor oznaczający alarm/zgłoszenie
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Zgłaszany (Podejrzany)', value: `${targetMember} (\`${targetMember.id}\`)`, inline: true },
                    { name: '🕵️ Zgłaszający', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                    { name: '📍 Kanał zgłoszenia', value: `${message.channel}`, inline: true },
                    { name: '📝 Powód zgłoszenia', value: `\`\`\`${reason}\`\`\``, inline: false }
                )
                .setFooter({ text: 'System Reportów Ziomeczki.gg', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            // Wysyłamy raport na tajny kanał
            await reportChannel.send({ embeds: [reportEmbed] });

            // Ciche potwierdzenie dla zgłaszającego
            const successMsg = await message.channel.send(`✅ **${message.author.username}**, Twoje zgłoszenie na ${targetMember.user.username} zostało wysłane do administracji. Dziękujemy!`);
            setTimeout(() => successMsg.delete().catch(() => {}), 6000);
        }
    });
};
