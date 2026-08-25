const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    // ID, które podałeś
    const kanalWeryfikacjiID = '1291469640261828618';
    const rolaNiezweryfikowanyID = '1390649148151300176';
    const rolaUzytkownikID = '1291061962221944933';
    
    // Ten sam jasnożółty z powitalni
    const jasnyZolty = '#FFF275'; 

    // 1. Komenda dla Ciebie do postawienia panelu (!setup-weryfikacja)
    client.on('messageCreate', async (message) => {
        if (message.content === '!setup-weryfikacja' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalWeryfikacjiID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału weryfikacji o podanym ID!');

            const embed = new EmbedBuilder()
                .setColor(jasnyZolty)
                .setTitle('🛡️ Weryfikacja Użytkownika')
                .setDescription('Witaj na **BroBox.pl**!\n\nAby odblokować dostęp do wszystkich kanałów na serwerze, musisz przejść szybką weryfikację.\n\nKliknij zielony przycisk poniżej, aby otrzymać rolę i zacząć pisać z innymi! 🚀')
                .setFooter({ 
                    text: 'BroBox.pl - System Weryfikacji',
                    iconURL: message.guild.iconURL({ dynamic: true })
                });

            // Zielony przycisk z emotką po lewej
            const przycisk = new ButtonBuilder()
                .setCustomId('weryfikacja_btn')
                .setLabel('Kliknij, aby się zweryfikować')
                .setEmoji('✅') // Zmień to na ID własnej emotki, jeśli masz dodaną na serwerze
                .setStyle(ButtonStyle.Success); // Style.Success odpowiada za zielony kolor

            const komponenty = new ActionRowBuilder().addComponents(przycisk);

            // Wysyła panel na kanał weryfikacji
            await kanal.send({ embeds: [embed], components: [komponenty] });
            message.reply('✅ Panel weryfikacyjny został pomyślnie wysłany na odpowiedni kanał!');
        }
    });

    // 2. Obsługa kliknięcia w zielony przycisk
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'weryfikacja_btn') {
            const member = interaction.member;

            // Zabezpieczenie przed klikaniem przez zweryfikowanych
            if (member.roles.cache.has(rolaUzytkownikID)) {
                return interaction.reply({ 
                    content: 'Jesteś już zweryfikowany!', 
                    ephemeral: true // Widoczne tylko dla klikającego
                });
            }

            try {
                // Nadaje nową rolę
                await member.roles.add(rolaUzytkownikID);
                // Odbiera starą rolę
                await member.roles.remove(rolaNiezweryfikowanyID);

                // Dyskretna wiadomość zwrotna o sukcesie
                await interaction.reply({ 
                    content: '🎉 Zostałeś pomyślnie zweryfikowany! Witamy na **BroBox.pl**.', 
                    ephemeral: true 
                });
                
            } catch (error) {
                console.error('Błąd ról:', error);
                interaction.reply({ 
                    content: 'Wystąpił błąd! Upewnij się, że rola bota jest nad rolami, które ma dodawać/usuwać w ustawieniach serwera.', 
                    ephemeral: true 
                });
            }
        }
    });
};
