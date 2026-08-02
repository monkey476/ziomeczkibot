const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

// --- KONFIGURACJA TICKETÓW ---
const TICKET_CATEGORY_ID = ''; // Opcjonalnie: ID kategorii na kanały ticketów
const LOG_CHANNEL_ID = '1532832889773883412'; // Kanał na logi zamkniętych ticketów

module.exports = (client) => {

    // 1. KOMENDA DO WYSŁANIA PANELU: !setup-ticket
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.trim().startsWith('!setup-ticket')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply({ content: '❌ Brak uprawnień do użycia tej komendy. Wymagany Administrator!' });
            }

            await message.delete().catch(() => {});

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • CENTRUM WSPARCIA', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🎫 Skontaktuj się z Administracją')
                .setDescription(
                    `> Witaj w profesjonalnym centrum pomocy!\n\n` +
                    `Jeśli masz pytanie, znalazłeś błąd, chcesz dołączyć do naszego zespołu lub załatwić inną sprawę, jesteś w idealnym miejscu.\n\n` +
                    `👇 **Jak to działa?**\n` +
                    `Rozwiń menu poniżej i wybierz kategorię, która najlepiej opisuje Twój problem. Bot automatycznie utworzy dla Ciebie **prywatny ticket**.`
                )
                .setColor('#2b2d31') 
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Zapewniamy szybką i sprawną pomoc! • Side Community Ziomeczki.gg', iconURL: client.user.displayAvatarURL() });

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
        
        // --- TWORZENIE TICKETU Z MENU ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'premium_ticket_menu') {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const member = interaction.member;
            const selectedValue = interaction.values[0];

            let categoryName = 'pytanie';
            let categoryTitle = 'Pytanie / Pomoc';
            let color = '#3498DB'; 

            if (selectedValue === 'ticket_blad') { categoryName = 'blad'; categoryTitle = 'Zgłoszenie Błędu'; color = '#E74C3C'; } 
            else if (selectedValue === 'ticket_rekrutacja') { categoryName = 'rekrutacja'; categoryTitle = 'Rekrutacja do zespołu'; color = '#2ECC71'; } 
            else if (selectedValue === 'ticket_inne') { categoryName = 'inne'; categoryTitle = 'Inna Sprawa'; color = '#9B59B6'; } 

            const existingChannel = guild.channels.cache.find(c => c.name === `${categoryName}-${member.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ Posiadasz już otwarty ticket w tej kategorii: ${existingChannel}` });
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: `${categoryName}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID ? TICKET_CATEGORY_ID : null,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Kategoria: ${categoryTitle}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                    .setTitle(`🎫 Witaj w swoim tickecie, ${member.user.username}!`)
                    .setDescription(
                        `> Administracja została powiadomiona i wkrótce się z Tobą skontaktuje.\n\n` +
                        `**Aby przyspieszyć proces, opisz dokładnie swój problem lub sprawę poniżej.** Jeśli posiadasz zrzuty ekranu, śmiało je tutaj wyślij.\n\n` +
                        `*Gdy sprawa zostanie załatwiona, kliknij przycisk poniżej, aby zamknąć kanał.*`
                    )
                    .setColor(color)
                    .setTimestamp();

                const ticketRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Zamknij ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Przejmij (Tylko Staff)')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🙋‍♂️')
                );

                await ticketChannel.send({ content: `${member} | @here`, embeds: [ticketEmbed], components: [ticketRow] });
                
                await interaction.message.edit({ components: [interaction.message.components[0]] }).catch(() => {});
                await interaction.editReply({ content: `✅ Twój ticket został pomyślnie utworzony: ${ticketChannel}` });

            } catch (error) {
                console.error('Błąd podczas tworzenia ticketu:', error);
                await interaction.editReply({ content: '❌ Wystąpił błąd podczas tworzenia kanału. Sprawdź, czy bot ma uprawnienie "Zarządzanie Kanałami".' });
            }
        }

        // --- OBSŁUGA PRZYCISKÓW W TICKETOM ---
        if (!interaction.isButton()) return;

        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: '❌ Tylko administracja może przejmować tickety!', ephemeral: true });
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.addFields({ name: '🛠️ Ticket obsługiwany przez:', value: `${interaction.user}`, inline: false });
            
            await interaction.update({ embeds: [embed] });
            await interaction.followUp({ content: `✅ Ticket został przejęty przez ${interaction.user}.` });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 Ticket zostanie bezpowrotnie zamknięty za **5 sekund**...' });

            // Generowanie transkryptu (historii wiadomości) oraz wysyłanie logu
            if (LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    try {
                        // Pobieramy całą historię wiadomości z kanału
                        let messages = await interaction.channel.messages.fetch({ limit: 100 });
                        let sortedMessages = Array.from(messages.values()).reverse();

                        let transcriptText = `--- HISTORIA ROZMOWY Z TICKETU: #${interaction.channel.name} ---\n\n`;
                        sortedMessages.forEach(m => {
                            let time = new Date(m.createdTimestamp).toLocaleString();
                            transcriptText += `[${time}] ${m.author.tag}: ${m.content}\n`;
                            if (m.attachments.size > 0) {
                                m.attachments.forEach(att => {
                                    transcriptText += `   [Załącznik: ${att.url}]\n`;
                                });
                            }
                        });

                        // Tworzymy plik tekstowy z historią
                        const buffer = Buffer.from(transcriptText, 'utf-8');
                        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

                        const logEmbed = new EmbedBuilder()
                            .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • LOGI TICKETÓW', iconURL: interaction.guild.iconURL({ dynamic: true }) || null })
                            .setTitle('🔒 Zamknięto ticket')
                            .setDescription(`> Poniżej znajdują się szczegóły zamkniętego zgłoszenia oraz załączona historia wiadomości.`)
                            .addFields(
                                { name: '📂 Nazwa kanału', value: `\`#${interaction.channel.name}\``, inline: true },
                                { name: '👤 Zamknięty przez', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
                            )
                            .setColor('#E74C3C')
                            .setTimestamp();
                        
                        await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                    } catch (err) {
                        console.error('Błąd podczas generowania transkryptu ticketu:', err);
                    }
                }
            }

            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    });
};
