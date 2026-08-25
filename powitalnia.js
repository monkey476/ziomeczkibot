const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // ID Twojego kanału powitalnego
    const kanalPowitanID = '1291077819954364457';
    // Ładny, jasnożółty kolor (Hex code)
    const jasnyZolty = '#FFF275'; 

    function stworzEmbedPowitalny(member) {
        // Obliczamy datę dołączenia do Discorda w formacie, który sam ładnie się wyświetla
        const dataDolaczenia = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;

        return new EmbedBuilder()
            .setColor(jasnyZolty)
            .setAuthor({ 
                name: `Witaj na BroBox.pl, ${member.user.username}!`, 
                iconURL: member.user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`Cześć <@${member.id}>! Super, że do nas dołączyłeś.\nRozgość się i czekaj z nami na wielki start serwera w 2027! 🚀`)
            .addFields(
                { name: '👥 Jesteś naszym', value: `**${member.guild.memberCount}** graczem na serwerze!`, inline: true },
                { name: '📅 Kiedy dołączyłeś?', value: dataDolaczenia, inline: true }
            )
            .setFooter({ 
                text: 'BroBox.pl - Oficjalny Discord', 
                iconURL: member.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();
    }

    // 1. Obsługa prawdziwego dołączenia gracza na serwer
    client.on('guildMemberAdd', async (member) => {
        const kanal = member.guild.channels.cache.get(kanalPowitanID);
        if (!kanal) return console.log('Błąd: Nie znaleziono kanału powitań!');

        const powitanieEmbed = stworzEmbedPowitalny(member);
        
        // Wysyła tylko sam, czysty embed, bez dodatkowego tekstu nad nim
        kanal.send({ embeds: [powitanieEmbed] });
    });

    // 2. Obsługa komendy !test-powitalnia
    client.on('messageCreate', async (message) => {
        if (message.content === '!test-powitalnia' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalPowitanID);
            
            if (!kanal) {
                return message.reply('Nie mogę znaleźć kanału o ID podanym w kodzie!');
            }

            const testowyEmbed = stworzEmbedPowitalny(message.member);
            
            // Wysyła tylko embed, usunięto [TEST] i oznaczanie
            kanal.send({ embeds: [testowyEmbed] });
            message.reply('✅ Wysłano testowe powitanie na kanał powitalny!');
        }
    });
};
