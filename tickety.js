const { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

// STANOWISKA I KONFIGURACJA
const firmowyKolor = '#FFF275';
const KATEGORIA_ID = '1494425319862436031';
const ROLA_ADMIN_ID = '1495094192957817025';
const LOGI_KANAL_ID = '1505560669326413985';

const ticketCache = new Map();

module.exports = (client) => {

    // 1. KOMENDA SETUP TICKETÓW (!setup-tickety)
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!setup-tickety') {
            if (!message.member.roles.cache.has(ROLA_ADMIN_ID) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Nie posiadasz uprawnień do użycia tej komendy.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🎫 BROBOX.PL × SYSTEM TICKETÓW')
                .setDescription(
                    'Witaj w systemie wsparcia **BroBox.pl**!\n' +
                    'Wybierz odpowiedni typ zgłoszenia z menu poniżej.\n\n' +
                    '---\n\n' +
                    '*Po wybraniu opcji zostaniesz poproszony o wypełnienie krótkiego formularza.*'
                )
                .setColor(firmowyKolor)
                .setFooter({ text: 'BroBox.pl • System Zgłoszeń' });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Wybierz rodzaj zgłoszenia...')
                .addOptions([
                    { label: 'Pomoc Ogólna', description: 'Masz pytanie dotyczące serwera lub ogólny problem.', value: 'pomoc_ogolna', emoji: '🆘' },
                    { label: 'Problemy z Kontem', description: 'Problemy z logowaniem, hasłem lub utraconymi przedmiotami.', value: 'problemy_konto', emoji: '🔑' },
                    { label: 'Współpraca', description: 'Chcesz zostać naszym partnerem (YouTube, Twitch, Discord).', value: 'wspolpraca', emoji: '💼' },
                    { label: 'Zgłoszenie Gracza', description: 'Ktoś łamie regulamin i chcesz to zgłosić.', value: 'zgloszenie_gracza', emoji: '⚠️' },
                    { label: 'Odwołanie od Bana', description: 'Uważasz, że Twoja kara jest niesłuszna.', value: 'odwolanie_ban', emoji: '🔨' },
                    { label: 'Rekrutacja', description: 'Chcesz dołączyć do zespołu naszego serwera.', value: 'rekrutacja', emoji: '📝' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            if (message.deletable) message.delete().catch(() => {});
        }
    });

    // 2. OBSŁUGA WYBORU Z MENU (OTWIERANIE MODALA)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'ticket_select_menu') return;

        const wyboR = interaction.values[0];
        let modal = new ModalBuilder();

        if (wyboR === 'pomoc_ogolna') {
            modal.setCustomId('modal_pomoc_ogolna').setTitle('Ticket: Pomoc Ogólna');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Nick z Minecraft').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opis').setLabel('Opisz problem').setPlaceholder('Opisz swój problem...').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (wyboR === 'problemy_konto') {
            modal.setCustomId('modal_problemy_konto').setTitle('Ticket: Problemy z Kontem');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Nick z Minecraft').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('typ_problemu').setLabel('Typ problemu (np. Hasło, Przedmioty)').setPlaceholder('Co się stało?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opis').setLabel('Szczegółowy opis').setPlaceholder('Opisz sytuację...').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (wyboR === 'wspolpraca') {
            modal.setCustomId('modal_wspolpraca').setTitle('Ticket: Współpraca');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Nick / Nazwa').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('link').setLabel('Link do kanału / oferty').setPlaceholder('https://...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opis').setLabel('Propozycja współpracy').setPlaceholder('Co oferujesz?').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (wyboR === 'zgloszenie_gracza') {
            modal.setCustomId('modal_zgloszenie_gracza').setTitle('Ticket: Zgłoszenie Gracza');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Twój Nick').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('oskarzony').setLabel('Nick Oskartego Gracza').setPlaceholder('Nick gracza...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('powod').setLabel('Powód i dowody').setPlaceholder('Opisz powód oraz wklej link do dowodów...').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (wyboR === 'odwolanie_ban') {
            modal.setCustomId('modal_odwolanie_ban').setTitle('Ticket: Odwołanie od Bana');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Twój Nick z Minecraft').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('powod_bana').setLabel('Powód bana').setPlaceholder('Za co dostałeś bana?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dlaczego').setLabel('Dlaczego powinieneś dostać unbana?').setPlaceholder('Wyjaśnij sytuację...').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (wyboR === 'rekrutacja') {
            modal.setCustomId('modal_rekrutacja').setTitle('Ticket: Rekrutacja');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick').setLabel('Nick z Minecraft').setPlaceholder('Twój nick...').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('wiek').setLabel('Wiek').setPlaceholder('Ile masz lat?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rola').setLabel('Ranga (Helper/Budowniczy itp.)').setPlaceholder('Na jaką rangę aplikujesz?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dlaczego_ty').setLabel('Dlaczego akurat Ty?').setPlaceholder('Napisz coś o sobie...').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }

        await interaction.showModal(modal);
    });

    // 3. OBSŁUGA WYSŁANEGO FORMULARZA (TWORZENIE KANAŁU TICKETU)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('modal_')) return;

        await interaction.deferReply({ ephemeral: true });

        const typeMap = {
            'modal_pomoc_ogolna': 'Pomoc Ogólna',
            'modal_problemy_konto': 'Problemy z Kontem',
            'modal_wspolpraca': 'Współpraca',
            'modal_zgloszenie_gracza': 'Zgłoszenie Gracza',
            'modal_odwolanie_ban': 'Odwołanie od Bana',
            'modal_rekrutacja': 'Rekrutacja'
        };

        const kategoriaNazwa = typeMap[interaction.customId] || 'Zgłoszenie';
        const cleanUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `ticket-${cleanUser}`;

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.editReply({ content: `❌ Posiadasz już otwarty ticket: ${existingChannel}` });
        }

        const formData = [];
        interaction.fields.fields.forEach(field => {
            formData.push({ name: field.customId, label: field.label, value: field.value });
        });

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: KATEGORIA_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
                { id: ROLA_ADMIN_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });

        ticketCache.set(ticketChannel.id, {
            owner: interaction.user,
            category: kategoriaNazwa,
            formData: formData,
            createdAt: new Date(),
            claimedBy: null
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`🎫 BroBox.pl — ${kategoriaNazwa}`)
            .setDescription(
                `Witaj <@${interaction.user.id}>!\n` +
                `Oto szczegóły Twojego zgłoszenia. Administracja zajmie się nim najszybciej jak to możliwe.\n\n` +
                '---\n\n'
            )
            .setColor(firmowyKolor)
            .setFooter({ text: `Użytkownik: ${interaction.user.tag} (${interaction.user.id})` })
            .setTimestamp();

        formData.forEach(item => {
            ticketEmbed.addFields({ name: `📌 ${item.label}`, value: item.value || 'Brak danych', inline: false });
        });

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Przejmij ticket').setStyle(ButtonStyle.Success).setEmoji('📌'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Zamknij ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await ticketChannel.send({
            content: `<@${interaction.user.id}> | <@&${ROLA_ADMIN_ID}>`,
            embeds: [ticketEmbed],
            components: [actionButtons]
        });

        await interaction.editReply({ content: `✅ Twój ticket został pomyślnie utworzony: ${ticketChannel}` });
    });

    // 4. OBSŁUGA PRZYCISKÓW (PRZEJMOWANIE I ZAMYKANIE + LOGI)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        const data = ticketCache.get(interaction.channel.id);

        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.roles.cache.has(ROLA_ADMIN_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Tylko Administracja może przejmować tickety.', ephemeral: true });
            }

            if (data && data.claimedBy) {
                return interaction.reply({ content: `❌ Ten ticket został już przejęty przez <@${data.claimedBy.id}>.`, ephemeral: true });
            }

            if (data) data.claimedBy = interaction.user;

            await interaction.reply({ content: `📌 **Ten ticket został przejęty przez:** <@${interaction.user.id}>` });
        }

        if (interaction.customId === 'close_ticket') {
            if (!interaction.member.roles.cache.has(ROLA_ADMIN_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator) && data && interaction.user.id !== data.owner.id) {
                return interaction.reply({ content: '❌ Nie masz uprawnień do zamknięcia tego ticketu.', ephemeral: true });
            }

            await interaction.reply('🔒 Kanał zostanie zamknięty i usunięty za 5 sekund...');

            const logsChannel = interaction.guild.channels.cache.get(LOGI_KANAL_ID);
            if (logsChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📜 ZAAWANSOWANE LOGI — ZAMKNIĘCIE TICKETU')
                    .setColor(firmowyKolor)
                    .addFields(
                        { name: '👤 Otwierający:', value: data ? `${data.owner.tag} (\`${data.owner.id}\`)` : 'Nieznany', inline: true },
                        { name: '🔒 Zamknięty przez:', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
                        { name: '📌 Przejęty przez:', value: (data && data.claimedBy) ? `${data.claimedBy.tag} (\`${data.claimedBy.id}\`)` : 'Nieprzejęty', inline: true },
                        { name: '📂 Kategoria:', value: data ? data.category : 'Brak danych', inline: true },
                        { name: '📅 Data otwarcia:', value: data ? `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F>` : 'Brak', inline: true },
                        { name: '⏱️ Data zamknięcia:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '\u200b', value: '---\n**DANE Z FORMULARZA:**', inline: false }
                    );

                if (data && data.formData) {
                    data.formData.forEach(field => {
                        logEmbed.addFields({ name: `📝 ${field.label}`, value: field.value || 'Brak', inline: false });
                    });
                }

                logEmbed.addFields({ name: '\u200b', value: `---\nNazwa kanału: \`${interaction.channel.name}\``, inline: false });
                logEmbed.setTimestamp();

                await logsChannel.send({ embeds: [logEmbed] });
            }

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
                ticketCache.delete(interaction.channel.id);
            }, 5000);
        }
    });
};
