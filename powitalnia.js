const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    const kanalPowitanID = '1291077819954364457';
    const jasnyZolty = '#FFF275'; 

    // Prosta pamięć podręczna (cache), żeby gracze nie mogli nabijać licznika po kilka razy
    // Struktura: { 'ID_WIADOMOSCI': ['ID_GRACZA1', 'ID_GRACZA2'] }
    const przywitaniaCache = {};

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

    // Funkcja tworząca przycisk z dynamiczną liczbą kliknięć
    function stworzPrzyciskPowitalny(liczba = 0) {
        const przycisk = new ButtonBuilder()
            .setCustomId('przywitaj_gracza')
            .setLabel(`Przywitało się z nim ${liczba} użytkowników`)
            .setStyle(ButtonStyle.Primary);

        return new ActionRowBuilder().addComponents(przycisk);
    }

    // 1. Prawdziwe dołączenie gracza
    client.on('guildMemberAdd', async (member) => {
        const kanal = member.guild.channels.cache.get(kanalPowitanID);
        if (!kanal) return console.log('Błąd: Nie znaleziono kanału powitań!');

        const embed = stworzEmbedPowitalny(member);
        const komponenty = stworzPrzyciskPowitalny(0);

        kanal.send({ embeds: [embed], components: [komponenty] });
    });

    // 2. Komenda !test-powitalnia
    client.on('messageCreate', async (message) => {
        if (message.content === '!test-powitalnia' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalPowitanID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału o ID podanym w kodzie!');

            const embed = stworzEmbedPowitalny(message.member);
            const komponenty = stworzPrzyciskPowitalny(0);

            kanal.send({ embeds: [embed], components: [komponenty] });
            message.reply('✅ Wysłano testowe powitanie na kanał powitalny!');
        }
    });

    // 3. Obsługa kliknięcia w przycisk "Przywitaj się!"
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        
        if (interaction.customId === 'przywitaj_gracza') {
            const messageId = interaction.message.id;
            const userId = interaction.user.id;

            // Tworzymy pustą listę dla tej wiadomości, jeśli ktoś klika w nią pierwszy raz
            if (!przywitaniaCache[messageId]) {
                przywitaniaCache[messageId] = [];
            }

            // Sprawdzamy, czy użytkownik już przypadkiem nie kliknął
            if (przywitaniaCache[messageId].includes(userId)) {
                return interaction.reply({ 
                    content: 'Już przywitałeś się z tym graczem!', 
                    ephemeral: true 
                });
            }

            // Dodajemy gracza do listy
            przywitaniaCache[messageId].push(userId);

            // Pobieramy nową, łączną liczbę powitań
            const nowaLiczba = przywitaniaCache[messageId].length;

            // Generujemy zaktualizowany przycisk
            const noweKomponenty = stworzPrzyciskPowitalny(nowaLiczba);

            // Błyskawicznie aktualizujemy wiadomość (bez wysyłania nowej na czat)
            await interaction.update({ components: [noweKomponenty] });
        }
    });
};
