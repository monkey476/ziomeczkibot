const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// --- KONFIGURACJA WERYFIKACJI ---
const VERIFIED_ROLE_ID = '1532411605592047636'; // Rola nadawana po weryfikacji

module.exports = (client) => {
    
    // 1. KOMENDA DO STWORZENIA PANELU WERYFIKACJI (!setup-weryfikacja)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content === '!setup-weryfikacja') {
            // Zabezpieczenie: Tylko administrator może ustawić panel
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply({ content: '❌ Brak uprawnień do użycia tej komendy.', ephemeral: true });
            }

            await message.delete().catch(() => {});

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • SYSTEM OCHRONY', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🛡️ Weryfikacja Użytkownika')
                .setDescription(
                    `> Witaj na serwerze! Aby uzyskać pełny dostęp do kanałów, musisz przejść szybką weryfikację.\n\n` +
                    `> Kliknij zielony przycisk poniżej, aby potwierdzić, że jesteś człowiekiem i zaakceptować zasady serwera.`
                )
                .setColor('#2ECC71') // Bezpieczny, zielony kolor
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Ochrona przed botami • Side Community Ziomeczki.gg', iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Zweryfikuj się')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // 2. OBSŁUGA KLIKNIĘCIA W PRZYCISK WERYFIKACJI
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'verify_user') {
            // Ukryta odpowiedź (widzi ją tylko klikający)
            await interaction.deferReply({ ephemeral: true });

            const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
            
            if (!role) {
                return interaction.editReply({ content: '❌ Wystąpił błąd: Rola weryfikacyjna nie została znaleziona na serwerze. Zgłoś to administracji!' });
            }

            const member = interaction.member;

            // Sprawdzenie, czy użytkownik ma już tę rolę (żeby nie spamować API)
            if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.editReply({ content: '⚠️ Jesteś już zweryfikowany i masz dostęp do serwera!' });
            }

            try {
                // Nadanie roli
                await member.roles.add(role);
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Sukces!')
                    .setDescription('Pomyślnie zweryfikowano! Otrzymałeś dostęp do reszty kanałów na serwerze. Baw się dobrze!')
                    .setColor('#2ECC71');

                await interaction.editReply({ embeds: [successEmbed] });
            } catch (error) {
                console.error('Błąd weryfikacji:', error);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas nadawania roli. **Upewnij się, że rola bota jest wyżej w ustawieniach serwera niż rola weryfikacji!**' });
            }
        }
    });
};
