const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// --- KONFIGURACJA WERYFIKACJI (Twoje ID) ---
const VERIFY_CHANNEL_ID = '1532519461414895827'; 
const VERIFIED_ROLE_ID = '1532514463972855858'; 

module.exports = (client) => {
    
    // 1. Komenda do wygenerowania pięknego panelu: !setupweryfikacja
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!setupweryfikacja' && message.channel.id === VERIFY_CHANNEL_ID) {
            await message.delete().catch(() => {});

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • SYSTEM OCHRONY', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🛡️ Weryfikacja Użytkowników')
                .setDescription(
                    `> Witaj na serwerze ** Side Community Ziomeczki.gg**!\n\n` +
                    `Aby uzyskać pełny dostęp do kanałów, musisz przejść szybką i prostą weryfikację anty-botową.\n\n` +
                    `✨ *Kliknij przycisk poniżej, aby otworzyć formularz weryfikacyjny.*`
                )
                .setColor('#2b2d31') // Elegancki ciemny motyw Discorda
                .setThumbnail('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Zabezpieczone przez ZiomeczekBot', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_verify_modal')
                    .setLabel('Przejdź weryfikację')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛡️')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // 2. Kliknięcie przycisku otwiera nowoczesne okienko (Modal)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'open_verify_modal') {
            const member = interaction.member;

            // Sprawdzanie czy użytkownik ma już rolę
            if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.reply({ content: '✨ Jesteś już zweryfikowany na tym serwerze!', ephemeral: true });
            }

            // Tworzenie modalu (Wyskakującego okienka)
            const modal = new ModalBuilder()
                .setCustomId('verify_modal_submit')
                .setTitle('Weryfikacja Ziomeczki.gg');

            const answerInput = new TextInputBuilder()
                .setCustomId('verify_answer')
                .setLabel('WPISZ SŁOWO: "ziomeczki"')
                .setPlaceholder('Wpisz tutaj małą literą...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(15);

            const firstActionRow = new ActionRowBuilder().addComponents(answerInput);
            modal.addComponents(firstActionRow);

            // Wyświetlenie okienka użytkownikowi
            await interaction.showModal(modal);
        }
    });

    // 3. Sprawdzenie odpowiedzi z formularza i nadanie roli
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;

        if (interaction.customId === 'verify_modal_submit') {
            const userAnswer = interaction.fields.getTextInputValue('verify_answer').trim().toLowerCase();
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);

            if (!role) {
                return interaction.reply({ content: '❌ Błąd krytyczny: Nie znaleziono roli o podanym ID w kodzie bota!', ephemeral: true });
            }

            // Weryfikacja wpisanego słowa
            if (userAnswer !== 'ziomeczki') {
                return interaction.reply({ 
                    content: '❌ **Błędna odpowiedź!** Musisz wpisać dokładnie słowo: `ziomeczki`. Spróbuj ponownie kliknąć przycisk.', 
                    ephemeral: true 
                });
            }

            try {
                // Nadanie roli
                await member.roles.add(role);

                // Sukces
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Pomyślna weryfikacja!')
                    .setDescription('Gratulacje! Otrzymałeś dostęp do serwera **Ziomeczki.gg**. Miłego pobytu!')
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.reply({ embeds: [successEmbed], ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ 
                    content: '❌ Wystąpił błąd podczas nadawania roli. Upewnij się, że rola bota jest wyżej na liście ról niż rola zweryfikowanego oraz że bot ma uprawnienie do zarządzania rolami!', 
                    ephemeral: true 
                });
            }
        }
    });
};
