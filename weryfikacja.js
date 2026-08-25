const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

module.exports = (client) => {
    const kanalWeryfikacjiID = '1291469640261828618';
    const rolaNiezweryfikowanyID = '1390649148151300176';
    const rolaUzytkownikID = '1291061962221944933';
    
    const jasnyZolty = '#FFF275'; 

    // Pamięć podręczna na wygenerowane kody CAPTCHA (User ID -> Kod)
    const captchaKody = new Map();

    // Funkcja generująca losowy, czytelny kod CAPTCHA (5 znaków)
    function wygenerujKod(dlugosc = 5) {
        const znaki = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omijamy trudne do pomylenia znaki (O, 0, I, 1)
        let kod = '';
        for (let i = 0; i < dlugosc; i++) {
            kod += znaki.charAt(Math.floor(Math.random() * znaki.length));
        }
        return kod;
    }

    // 1. Komenda do stawiania panelu (!setup-weryfikacja)
    client.on('messageCreate', async (message) => {
        if (message.content === '!setup-weryfikacja' && message.member.permissions.has('Administrator')) {
            const kanal = message.guild.channels.cache.get(kanalWeryfikacjiID);
            if (!kanal) return message.reply('Nie mogę znaleźć kanału weryfikacji o podanym ID!');

            const embed = new EmbedBuilder()
                .setColor(jasnyZolty)
                .setTitle('🔐 WERYFIKACJA | BroBox.pl')
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setDescription(
                    ` **Witaj na oficjalnym Discordzie BroBox.pl!**\n` +
                    ` Przejdź szybką weryfikację CAPTCHA, aby odblokować dostęp do reszty serwera.\n\n` +
                    `📋 **Jak się zweryfikować?**\n` +
                    `1️⃣ Kliknij zielony przycisk poniżej.\n` +
                    `2️⃣ Przepisz kod CAPTCHA, który pojawi się w okienku.\n` +
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
            message.reply('✅ Panel weryfikacyjny z CAPTCHA został wysłany!');
        }
    });

    // 2. Obsługa kliknięcia w przycisk i wysłanie Modal ze sprawdzianem CAPTCHA
    client.on('interactionCreate', async (interaction) => {
        // Kliknięcie w zielony przycisk
        if (interaction.isButton() && interaction.customId === 'weryfikacja_btn') {
            const member = interaction.member;

            // Sprawdzenie czy gracz jest już zweryfikowany
            if (member.roles.cache.has(rolaUzytkownikID)) {
                return interaction.reply({ 
                    content: 'Jesteś już zweryfikowany na BroBox.pl!', 
                    ephemeral: true 
                });
            }

            // Generujemy unikalny kod CAPTCHA dla tego użytkownika
            const kodCaptcha = wygenerujKod(5);
            captchaKody.set(interaction.user.id, kodCaptcha);

            // Tworzymy okienko wyskakujące (Modal)
            const modal = new ModalBuilder()
                .setCustomId('captcha_modal')
                .setTitle('🔐 Przepisz kod CAPTCHA');

            const input = new TextInputBuilder()
                .setCustomId('captcha_input')
                .setLabel(`Przepisz ten kod:  ${kodCaptcha}`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Wpisz kod tutaj (wielkość liter nie ma znaczenia)...')
                .setMinLength(5)
                .setMaxLength(5)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);

            // Pokazujemy okienko użytkownikowi
            await interaction.showModal(modal);
        }

        // 3. Obsługa wysłania formularza z okienka Modal
        if (interaction.isModalSubmit() && interaction.customId === 'captcha_modal') {
            const wpisanyKod = interaction.fields.getTextInputValue('captcha_input').trim().toUpperCase();
            const poprawnyKod = captchaKody.get(interaction.user.id);

            // Sprawdzamy czy kod z okienka zgadza się z wygenerowanym
            if (!poprawnyKod || wpisanyKod !== poprawnyKod) {
                captchaKody.delete(interaction.user.id);
                return interaction.reply({ 
                    content: '❌ Błędny kod CAPTCHA! Spróbuj ponownie klikając przycisk.', 
                    ephemeral: true 
                });
            }

            // Jeśli kod jest poprawny:
            captchaKody.delete(interaction.user.id);

            try {
                await interaction.member.roles.add(rolaUzytkownikID);
                await interaction.member.roles.remove(rolaNiezweryfikowanyID);

                await interaction.reply({ 
                    content: '🎉 Kod poprawny! Zostałeś pomyślnie zweryfikowany na **BroBox.pl**.', 
                    ephemeral: true 
                });
                
            } catch (error) {
                console.error('Błąd ról:', error);
                interaction.reply({ 
                    content: 'Wystąpił błąd podczas nadawania ról! Skontaktuj się z Administracją.', 
                    ephemeral: true 
                });
            }
        }
    });
};
