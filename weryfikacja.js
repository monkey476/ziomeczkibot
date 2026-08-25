const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    const kanalWeryfikacjiID = '1291469640261828618';
    const rolaNiezweryfikowanyID = '1390649148151300176';
    const rolaUzytkownikID = '1291061962221944933';
    
    const jasnyZolty = '#FFF275'; 

    client.on('messageCreate', async (message) => {
        if (message.content === '!setup-weryfikacja' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalWeryfikacjiID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału weryfikacji o podanym ID!');

            const embed = new EmbedBuilder()
                .setColor(jasnyZolty)
                .setTitle('🔐 WERYFIKACJA | BroBox.pl')
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setDescription(
                    `> **Witaj na oficjalnym Discordzie BroBox.pl!**\n` +
                    `> Przejdź szybką weryfikację, aby odblokować dostęp do reszty serwera.\n\n` +
                    `📋 **Jak się zweryfikować?**\n` +
                    `1️⃣ Kliknij zielony przycisk poniżej.\n` +
                    `2️⃣ Bot automatycznie przyzna Ci rolę gracza.\n` +
                    `3️⃣ Otrzymasz pełen dostęp do kanałów tekstowych i głosowych! \n\n` +
                    `⚠️ *W razie problemów z weryfikacją skontaktuj się z administracją.*`
                )
                .setFooter({ 
                    text: 'BroBox.pl - System Weryfikacji',
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            const przycisk = new ButtonBuilder()
                .setCustomId('weryfikacja_btn')
                .setLabel('Kliknij, aby się zweryfikować')
                .setEmoji('✅') 
                .setStyle(ButtonStyle.Success); 

            const komponenty = new ActionRowBuilder().addComponents(przycisk);

            await kanal.send({ embeds: [embed], components: [komponenty] });
            message.reply('✅ Nowy panel weryfikacyjny został wysłany!');
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'weryfikacja_btn') {
            const member = interaction.member;

            if (member.roles.cache.has(rolaUzytkownikID)) {
                return interaction.reply({ 
                    content: 'Jesteś już zweryfikowany na BroBox.pl!', 
                    ephemeral: true 
                });
            }

            try {
                await member.roles.add(rolaUzytkownikID);
                await member.roles.remove(rolaNiezweryfikowanyID);

                await interaction.reply({ 
                    content: '🎉 Zostałeś pomyślnie zweryfikowany! Witamy na **BroBox.pl**.', 
                    ephemeral: true 
                });
                
            } catch (error) {
                console.error('Błąd ról:', error);
                interaction.reply({ 
                    content: 'Wystąpił błąd podczas weryfikacji! Upewnij się, że rola bota jest wyżej w ustawieniach serwera.', 
                    ephemeral: true 
                });
            }
        }
    });
};
