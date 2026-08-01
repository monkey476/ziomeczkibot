const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

// --- KONFIGURACJA TICKETÓW ---
const TICKET_CHANNEL_ID = '1532519461414895827'; // Kanał, na którym ma być wysłany główny panel !setupbilet
const TICKET_CATEGORY_ID = ''; // Opcjonalnie: ID kategorii, do której mają wpadać tickety (zostaw '', jeśli ma tworzyć na samej górze)
const LOG_CHANNEL_ID = ''; // Opcjonalnie: ID kanału na logi zamkniętych ticketów (zostaw '', jeśli nie chcesz)

module.exports = (client) => {

    // 1. Komenda do wysłania luksusowego panelu: !setupbilet
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!setupbilet' && message.channel.id === TICKET_CHANNEL_ID) {
            await message.delete().catch(() => {});

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'ZIOMECZKI.GG • CENTRUM WSPARCIA', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🎫 System Zaawansowanych Biletów')
                .setDescription(
                    `> Potrzebujesz pomocy, chcesz coś zgłosić lub porozmawiać z administracją?\n\n` +
                    `Wybierz odpowiednią **kategorię z menu poniżej**, aby otworzyć swój prywatny, zabezpieczony kanał wsparcia.`
                )
                .setColor('#2b2d31') // Nowoczesny ciemny motyw
                .setThumbnail('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Ziomeczki.gg • Bezpieczny Support', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('📌 Wybierz temat zgłoszenia...')
                .addOptions([
                    {
                        label: 'Pomoc ogólna / Pytanie',
                        description: 'Masz problem z grą, serwerem lub bota?',
                        value: 'ticket_pomoc',
                        emoji: '🛠️'
                    },
                    {
                        label: 'Zakupy / Sklep / Płatności',
                        description: 'Problemy z rangą, walutą lub sklepem serwera',
                        value: 'ticket_sklep',
                        emoji: '💳'
                    },
                    {
                        label: 'Skarga na gracza / administrację',
                        description: 'Zgłoś złamanie regulaminu przez kogoś',
                        value: 'ticket_skarga',
                        emoji: '🚨'
                    },
                    {
                        label: 'Współpraca / Partnerstvo',
                        description: 'Propozycje współpracy lub media',
                        value: 'ticket_wspolpraca',
                        emoji: '🤝'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // 2. Obsługa interakcji (Menu wyboru oraz przyciski w biletach)
    client.on('interactionCreate', async (interaction) => {
        
        // --- KLIKNIĘCIE W MENU WYBORU KATEGORII ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const member = interaction.member;
            const selectedValue = interaction.values[0];

            // Tłumaczenie wartości na ładne nazwy
            let categoryName = 'pomoc';
            let categoryTitle = 'Pomoc ogólna';
            let color = '#3498DB';

            if (selectedValue === 'ticket_sklep') { categoryName = 'sklep'; categoryTitle = 'Zakupy / Sklep'; color = '#2ECC71'; }
            else if (selectedValue === 'ticket_skarga') { categoryName = 'skarga'; categoryTitle = 'Skarga / Zgłoszenie'; color = '#E74C3C'; }
            else if (selectedValue === 'ticket_wspolpraca') { categoryName = 'wspolpraca'; categoryTitle = 'Współpraca'; color = '#9B59B6'; }

            // Sprawdzanie, czy użytkownik ma już otwarty taki bilet
            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${categoryName}-${member.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Masz już otwarty bilet w tej kategorii: ${existingChannel}` });
            }

            try {
                // Tworzenie prywatnego kanału
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${categoryName}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID ? TICKET_CATEGORY_ID : null,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Kategoria: ${categoryTitle}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                    .setTitle(`🎫 Bilet użytkownika: ${member.user.tag}`)
                    .setDescription(
                        `> Witaj w swoim prywatnym bilecie!\n\n` +
                        `📋 **Kategoria:** ${categoryTitle}\n` +
                        `👤 **Autor:** ${member}\n\n` +
                        `Opisz dokładnie swój problem lub sprawę. Administracja została powiadomiona i wkrótce odpowie.\n\n` +
                        `*Gdy sprawa zostanie rozwiązana, użyj przycisku poniżej, aby zamknąć bilet.*`
                    )
                    .setColor(color)
                    .setTimestamp();

                const ticketRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Zamknij bilet')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Przejmij bilet (Staff)')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🙋‍♂️')
                );

                await ticketChannel.send({ content: `${member} | Administracja`, embeds: [ticketEmbed], components: [ticketRow] });
                await interaction.editReply({ content: `✅ Twój bilet został pomyślnie utworzony: ${ticketChannel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia kanału biletu. Sprawdź uprawnienia bota.' });
            }
        }

        // --- OBSŁUGA PRZYCISKÓW W BILECIE ---
        if (!interaction.isButton()) return;

        // PRZEJĘCIE BILETU PRZEZ ADMINISTRATORA
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({ content: '❌ Tylko administracja może przejmować bilety!', ephemeral: true });
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.addFields({ name: '🛠️ Przejęty przez', value: `${interaction.user}`, inline: false });
            
            await interaction.update({ embeds: [embed] });
            await interaction.followUp({ content: `✅ Bilet został przejęty przez ${interaction.user}.` });
        }

        // ZAMYKANIE BILETU
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Bilet zostanie bezpowrotnie zamknięty za **5 sekund**...' });

            // Wysyłanie logów, jeśli kanał logów jest ustawiony
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
