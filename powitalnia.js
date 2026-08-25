const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // ID Twojego kanału powitalnego
    const kanalPowitanID = '1291077819954364457';
    // Ładny, jasnożółty kolor (Hex code)
    const jasnyZolty = '#FFF275'; 

    // Funkcja budująca nasz estetyczny embed
    function stworzEmbedPowitalny(member) {
        // Obliczamy datę dołączenia do Discorda w formacie, który sam ładnie się wyświetla
        const dataDolaczenia = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;

        return new EmbedBuilder()
            .setColor(jasnyZolty)
            .setAuthor({ 
                name: `Witaj na brobox.pl, ${member.user.username}!`, 
                iconURL: member.user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`Cześć <@${member.id}>! Super, że do nas dołączyłeś.\nRozgość się i czekaj z nami na wielki start serwera w 2027! 🚀`)
            .addFields(
                { name: '👥 Jesteś naszym', value: `**${member.guild.memberCount}** graczem na serwerze!`, inline: true },
                { name: '📅 Kiedy dołączyłeś?', value: dataDolaczenia, inline: true }
            )
            .setFooter({ 
                text: 'brobox.pl - Oficjalny Discord', 
                iconURL: member.guild.iconURL({ dynamic: true }) // Daje ikonkę serwera na samym dole
            })
            .setTimestamp();
    }

    // 1. Obsługa prawdziwego dołączenia gracza na serwer
    client.on('guildMemberAdd', async (member) => {
        const kanal = member.guild.channels.cache.get(kanalPowitanID);
        if (!kanal) return console.log('Błąd: Nie znaleziono kanału powitań!');

        const powitanieEmbed = stworzEmbedPowitalny(member);
        
        // Wysyła wiadomość z oznaczeniem gracza i ładnym embedem
        kanal.send({ content: `Zróbcie hałas dla <@${member.id}>! 🎉`, embeds: [powitanieEmbed] });
    });

    // 2. Obsługa komendy !test-powitalnia
    client.on('messageCreate', async (message) => {
        // Sprawdzamy czy to komenda i czy używa jej admin, żeby gracze nie spamowali
        if (message.content === '!test-powitalnia' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalPowitanID);
            
            if (!kanal) {
                return message.reply('Nie mogę znaleźć kanału o ID podanym w kodzie!');
            }

            const testowyEmbed = stworzEmbedPowitalny(message.member);
            
            kanal.send({ content: `[TEST] Zróbcie hałas dla <@${message.member.id}>! 🎉`, embeds: [testowyEmbed] });
            message.reply('✅ Wysłano testowe powitanie na kanał powitalny!');
        }
    });
};
