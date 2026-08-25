const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    const kanalPowitanID = '1291077819954364457';
    const jasnyZolty = '#FFF275'; 
    const przywitaniaCache = {};

    function stworzEmbedPowitalny(member) {
        const dataDolaczenia = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;

        // Czysty powrót do poprzedniej wersji wyglądu
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

    function stworzPrzyciskPowitalny(liczba = 0) {
        const przycisk = new ButtonBuilder()
            .setCustomId('przywitaj_gracza')
            .setLabel(`Przywitało się z nim ${liczba} użytkowników`)
            .setStyle(ButtonStyle.Primary);

        return new ActionRowBuilder().addComponents(przycisk);
    }

    client.on('guildMemberAdd', async (member) => {
        const kanal = member.guild.channels.cache.get(kanalPowitanID);
        if (!kanal) return console.log('Błąd: Nie znaleziono kanału powitań!');

        const embed = stworzEmbedPowitalny(member);
        const komponenty = stworzPrzyciskPowitalny(0);

        kanal.send({ embeds: [embed], components: [komponenty] });
    });

    client.on('messageCreate', async (message) => {
        if (message.content === '!test-powitalnia' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalPowitanID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału o ID podanym w kodzie!');

            const embed = stworzEmbedPowitalny(message.member);
            const komponenty = stworzPrzyciskPowitalny(0);

            kanal.send({ embeds: [embed], components: [komponenty] });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === 'przywitaj_gracza') {
            const messageId = interaction.message.id;
            const userId = interaction.user.id;

            if (!przywitaniaCache[messageId]) {
                przywitaniaCache[messageId] = [];
            }

            if (przywitaniaCache[messageId].includes(userId)) {
                return interaction.reply({ 
                    content: 'Już przywitałeś się z tym graczem!', 
                    ephemeral: true 
                });
            }

            przywitaniaCache[messageId].push(userId);
            const nowaLiczba = przywitaniaCache[messageId].length;
            const noweKomponenty = stworzPrzyciskPowitalny(nowaLiczba);

            await interaction.update({ components: [noweKomponenty] });
        }
    });
};
