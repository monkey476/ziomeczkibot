const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    const kanalPowitanID = '1291077819954364457';
    const jasnyZolty = '#FFF275'; 

    function stworzEmbedPowitalny(member) {
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

    // 1. Prawdziwe dołączenie gracza
    client.on('guildMemberAdd', async (member) => {
        const kanal = member.guild.channels.cache.get(kanalPowitanID);
        if (!kanal) return console.log('Błąd: Nie znaleziono kanału powitań!');

        const embed = stworzEmbedPowitalny(member);
        kanal.send({ embeds: [embed] });
    });

    // 2. Komenda !test-powitalnia
    client.on('messageCreate', async (message) => {
        if (message.content === '!test-powitalnia' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalPowitanID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału o ID podanym w kodzie!');

            const embed = stworzEmbedPowitalny(message.member);
            kanal.send({ embeds: [embed] });
            message.reply('✅ Wysłano testowe powitanie na kanał powitalny!');
        }
    });
};
