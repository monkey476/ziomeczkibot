const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

// --- KONFIGURACJA TICKETÓW ---
const TICKET_CATEGORY_ID = ''; // Opcjonalnie: ID kategorii, do której mają wpadać tickety (zostaw '', jeśli ma tworzyć na samej górze)
const LOG_CHANNEL_ID = ''; // Opcjonalnie: ID kanału na logi zamkniętych ticketów

module.exports = (client) => {

    // 1. KOMENDA DO WYSŁANIA GIGA ZARĄBISTEGO PANELU: !setup-ticket
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!setup-ticket') {
            // Tylko administracja może to postawić
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply({ content: '❌ Brak uprawnień do użycia tej komendy.', ephemeral: true });
            }

            await message.delete().catch(() => {});

            // Główny embed panelu (nowoczesny, ciemny design)
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'ZIOMECZKI.GG • CENTRUM WSPARCIA', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🎫 Skontaktuj się z Administracją')
                .setDescription(
                    `> Witaj w profesjonalnym centrum pomocy!\n\n` +
                    `Jeśli masz pytanie, znalazłeś błąd, chcesz dołączyć do naszego zespołu lub załatwić inną sprawę, jesteś w idealnym miejscu.\n\n` +
                    `👇 **Jak to działa?**\n` +
                    `Rozwiń menu poniżej i wybierz kategorię, która najlepiej opisuje Twój problem. Bot automatycznie utworzy dla Ciebie **prywatny kanał**, do którego dostęp będziesz miał tylko Ty i Administracja.`
                )
                .setColor('#2b2d31') // Nowoczesny, "niewidzialny" ciemny kolor Discorda
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Zapewniamy szybką i sprawną pomoc! • Ziomeczki.gg', iconURL: client.user.displayAvatarURL() });

            // Menu wyboru (Dropdown)
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('premium_ticket_menu')
                .setPlaceholder('📌 Wybierz temat swojego zgłoszenia...')
                .addOptions([
                    {
                        label: 'Pytanie',
                        description: 'Masz pytanie dotyczące serwera lub naszych usług?',
                        value: 'ticket_pytanie',
                        emoji: '❓'
                    },
                    {
                        label: 'Mam Błąd',
                        description: 'Znalazłeś usterkę lub buga? Zgłoś to tutaj!',
                        value: 'ticket_blad',
                        emoji: '🐛'
                    },
                    {
                        label: 'Rekrutacja',
                        description: 'Chcesz dołączyć do naszego zespołu? Aplikuj!',
                        value: 'ticket_rekrutacja',
                        emoji: '📝'
                    },
                    {
                        label: 'Inna Sprawa',
                        description: 'Twój problem nie pasuje do innych kategorii?',
                        value: 'ticket_inne',
                        emoji: '📬'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // 2. OBSŁUGA INTERAKCJI (TWORZENIE I ZARZĄDZANIE TICKETEM)
    client.on('interactionCreate', async (interaction) => {
        
        // --- TWORZENIE BILETU Z MENU ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'premium_ticket_menu') {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const member = interaction.member;
            const selectedValue = interaction.values[0];

            // Tłumaczenie wyboru na dane biletu
            let categoryName = 'pytanie';
            let categoryTitle = 'Pytanie / Pomoc';
            let color = '#3498DB'; // Niebieski

            if (selectedValue === 'ticket_blad') { categoryName = 'blad'; categoryTitle = 'Zgłoszenie Błędu'; color = '#E74C3C'; } // Czerwony
            else if (selectedValue === 'ticket_rekrutacja') { categoryName = 'rekrutacja'; categoryTitle = 'Rekrutacja do zespołu'; color = '#2ECC71'; } // Zielony
            else if (selectedValue === 'ticket_inne') { categoryName = 'inne'; categoryTitle = 'Inna Sprawa'; color = '#9B59B6'; } // Fioletowy

            // Sprawdzanie limitu ticketów (czy gracz nie ma już otwartego w tej kategorii)
            const existingChannel = guild.channels.cache.find(c => c.name === `${categoryName}-${member.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Posiadasz już otwarty bilet w tej kategorii: ${existingChannel}` });
            }

            try {
                // Tworzenie prywatnego kanału
                const ticketChannel = await guild.channels.create({
                    name: `${categoryName}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID ? TICKET_CATEGORY_ID : null,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ],
                });

                // Embed wewnątrz nowo stworzonego ticketu
                const ticketEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Kategoria: ${categoryTitle}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                    .setTitle(`🎫 Witaj w swoim bilecie, ${member.user.username}!`)
                    .setDescription(
                        `> Administracja została powiadomiona i wkrótce się z Tobą skontaktuje.\n\n` +
                        `**Aby przyspieszyć proces, opisz dokładnie swój problem lub sprawę poniżej.** Jeśli posiadasz zrzuty ekranu, śmiało je tutaj wyślij.\n\n` +
                        `*Gdy sprawa zostanie załatwiona, kliknij przycisk poniżej, aby zamknąć kanał.*`
                    )
                    .setColor(color)
                    .setTimestamp();

                // Przyciski zarządzania wewnątrz ticketu
                const ticketRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Zamknij bilet')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Przejmij (Tylko Staff)')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🙋‍♂️')
                );

                await ticketChannel.send({ content: `${member} | @here`, embeds: [ticketEmbed], components: [ticketRow] });
                
                // Resetujemy menu w głównej wiadomości
                await interaction.message.edit({ components: [interaction.message.components[0]] });
                await interaction.editReply({ content: `✅ Twój bilet został pomyślnie utworzony: ${ticketChannel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia kanału. Sprawdź, czy bot ma uprawnienie "Zarządzanie Kanałami".' });
            }
        }

        // --- OBSŁUGA PRZYCISKÓW W BILECIE ---
        if (!interaction.isButton()) return;

        // Przejęcie ticketu
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ Tylko administracja może przejmować bilety!', ephemeral: true });
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.addFields({ name: '🛠️ Bilet obsługiwany przez:', value: `${interaction.user}`, inline: false });
            
            await interaction.update({ embeds: [embed] });
            await interaction.followUp({ content: `✅ Bilet został przejęty przez ${interaction.user}.` });
        }

        // Zamykanie ticketu
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Bilet zostanie bezpowrotnie zamknięty za **5 sekund**...' });

            if (LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔒 ZAMKNIĘTO BILET')
                        .setDescription(`> **Kanał:** #${interaction.channel.name}\n> **Zamknięty przez:** ${interaction.user}`)
                        .setColor('#E74C3C')
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    });
};
