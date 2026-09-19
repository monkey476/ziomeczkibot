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
    EmbedBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

const KOLOR = 0xFFF275;
const KOLOR_HEX = '#FFF275';

const KATEGORIA_ID = '1494425319862436031';
const ROLA_ADMIN_ID = '1495094192957817025';
const LOGI_KANAL_ID = '1505560669326413985';

const ticketCache = new Map();

const fieldLabels = {
    nick: 'Nick',
    opis: 'Opis sytuacji',
    typ_problemu: 'Typ problemu',
    link: 'Link do kanału / oferty',
    oskarzony: 'Oskarżony gracz',
    powod: 'Powód i dowody',
    powod_bana: 'Powód bana',
    dlaczego: 'Dlaczego mamy zdjąć karę?',
    wiek: 'Wiek',
    rola: 'Aplikowana ranga',
    dlaczego_ty: 'Dlaczego akurat Ty?'
};

const ticketTypes = {
    pomoc_ogolna: {
        label: 'Pomoc ogólna',
        emoji: '🆘',
        description: 'Pytania dotyczące serwera i ogólna pomoc.'
    },
    problemy_konto: {
        label: 'Problemy z kontem',
        emoji: '🔑',
        description: 'Logowanie, hasło, przedmioty lub konto.'
    },
    wspolpraca: {
        label: 'Współpraca',
        emoji: '💼',
        description: 'Partnerstwo, YouTube, Twitch lub Discord.'
    },
    zgloszenie_gracza: {
        label: 'Zgłoszenie gracza',
        emoji: '⚠️',
        description: 'Zgłoszenie osoby łamiącej regulamin.'
    },
    odwolanie_ban: {
        label: 'Odwołanie od bana',
        emoji: '🔨',
        description: 'Odwołanie od nałożonej kary.'
    },
    rekrutacja: {
        label: 'Rekrutacja',
        emoji: '📝',
        description: 'Chcesz dołączyć do ekipy BroBox.pl.'
    }
};

function isAdmin(member) {
    return Boolean(
        member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.roles?.cache?.has(ROLA_ADMIN_ID)
    );
}

function safeChannelName(username, userId) {
    const clean = username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 70);

    return `ticket-${clean || userId.slice(-6)}`;
}

function createTicketSetupPanel() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_menu')
        .setPlaceholder('Wybierz rodzaj zgłoszenia...')
        .addOptions(
            Object.entries(ticketTypes).map(([value, data]) => ({
                label: data.label,
                description: data.description,
                value,
                emoji: data.emoji
            }))
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const container = new ContainerBuilder()
        .setAccentColor(KOLOR)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# 🎫 BroBox.pl | Centrum pomocy\n' +
                'Witaj w oficjalnym systemie zgłoszeń.\n\n' +
                'Wybierz kategorię poniżej, aby utworzyć prywatny kanał z administracją.\n' +
                'Przed wysłaniem formularza przygotuj dokładny opis sytuacji i ewentualne dowody.'
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '### 📌 Zasady zgłoszeń\n' +
                '• Jeden użytkownik może posiadać jeden otwarty ticket.\n' +
                '• Nie oznaczaj administracji bez potrzeby.\n' +
                '• W zgłoszeniach gracza dodaj konkretne dowody.\n' +
                '• Po zakończeniu sprawy ticket zostanie zamknięty.'
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '**Wybierz temat zgłoszenia z menu poniżej:**'
            )
        )
        .addActionRowComponents(selectRow);

    return container;
}

function createTicketPanel(userId, userTag, categoryName, formData) {
    const container = new ContainerBuilder()
        .setAccentColor(KOLOR)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 🎫 BroBox.pl | ${categoryName}\n` +
                `Witaj <@${userId}>! Twoje zgłoszenie zostało utworzone.\n\n` +
                'Administracja otrzymała Twoje zgłoszenie. Opisz dodatkowe informacje w tym kanale, jeśli będą potrzebne.'
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## 📋 Szczegóły zgłoszenia'
            )
        );

    for (const item of formData) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${item.label}:**\n${item.value || 'Brak danych'}`
            )
        );
    }

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Przejmij ticket')
            .setEmoji('📌')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Zamknij ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
    );

    container
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '🔔 **Administracja:** odpowiadaj konkretnie i zachowuj kulturę wypowiedzi.'
            )
        )
        .addActionRowComponents(buttons);

    return container;
}

function createModal(type) {
    const modal = new ModalBuilder();

    const input = (
        id,
        label,
        placeholder,
        style = TextInputStyle.Short
    ) =>
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setPlaceholder(placeholder)
                .setStyle(style)
                .setRequired(true)
        );

    if (type === 'pomoc_ogolna') {
        modal
            .setCustomId('modal_pomoc_ogolna')
            .setTitle('Pomoc ogólna');

        modal.addComponents(
            input(
                'nick',
                'Nick z Minecraft',
                'Twój nick...'
            ),
            input(
                'opis',
                'Opisz problem',
                'Opisz dokładnie sytuację...',
                TextInputStyle.Paragraph
            )
        );
    }

    if (type === 'problemy_konto') {
        modal
            .setCustomId('modal_problemy_konto')
            .setTitle('Problemy z kontem');

        modal.addComponents(
            input(
                'nick',
                'Nick z Minecraft',
                'Twój nick...'
            ),
            input(
                'typ_problemu',
                'Typ problemu',
                'Np. hasło, przedmioty, logowanie...'
            ),
            input(
                'opis',
                'Szczegółowy opis',
                'Opisz dokładnie sytuację...',
                TextInputStyle.Paragraph
            )
        );
    }

    if (type === 'wspolpraca') {
        modal
            .setCustomId('modal_wspolpraca')
            .setTitle('Współpraca');

        modal.addComponents(
            input(
                'nick',
                'Nick / nazwa',
                'Twój nick lub nazwa projektu...'
            ),
            input(
                'link',
                'Link do kanału / oferty',
                'https://...'
            ),
            input(
                'opis',
                'Propozycja współpracy',
                'Co oferujesz?',
                TextInputStyle.Paragraph
            )
        );
    }

    if (type === 'zgloszenie_gracza') {
        modal
            .setCustomId('modal_zgloszenie_gracza')
            .setTitle('Zgłoszenie gracza');

        modal.addComponents(
            input(
                'nick',
                'Twój nick',
                'Twój nick...'
            ),
            input(
                'oskarzony',
                'Nick zgłaszanego gracza',
                'Nick gracza...'
            ),
            input(
                'powod',
                'Powód i dowody',
                'Opisz powód i dodaj linki do dowodów...',
                TextInputStyle.Paragraph
            )
        );
    }

    if (type === 'odwolanie_ban') {
        modal
            .setCustomId('modal_odwolanie_ban')
            .setTitle('Odwołanie od bana');

        modal.addComponents(
            input(
                'nick',
                'Twój nick z Minecraft',
                'Twój nick...'
            ),
            input(
                'powod_bana',
                'Powód bana',
                'Za co otrzymałeś bana?'
            ),
            input(
                'dlaczego',
                'Dlaczego unban?',
                'Wyjaśnij sytuację...',
                TextInputStyle.Paragraph
            )
        );
    }

    if (type === 'rekrutacja') {
        modal
            .setCustomId('modal_rekrutacja')
            .setTitle('Rekrutacja');

        modal.addComponents(
            input(
                'nick',
                'Nick z Minecraft',
                'Twój nick...'
            ),
            input(
                'wiek',
                'Wiek',
                'Ile masz lat?'
            ),
            input(
                'rola',
                'Na jaką rangę aplikujesz?',
                'Helper, Moderator, Budowniczy...'
            ),
            input(
                'dlaczego_ty',
                'Dlaczego akurat Ty?',
                'Napisz coś o sobie...',
                TextInputStyle.Paragraph
            )
        );
    }

    return modal;
}

module.exports = (client) => {

    // =====================================================
    // PANEL STARTOWY
    // =====================================================

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === '!setup-tickety') {

            if (!isAdmin(message.member)) {
                return message.reply(
                    '❌ Nie posiadasz uprawnień do użycia tej komendy.'
                );
            }

            try {

                await message.channel.send({
                    components: [
                        createTicketSetupPanel()
                    ],
                    flags: MessageFlags.IsComponentsV2
                });

                if (message.deletable) {
                    await message.delete().catch(() => {});
                }

            } catch (error) {

                console.error(
                    '❌ Błąd panelu ticketów:',
                    error
                );

                await message.reply(
                    '❌ Nie udało się wysłać panelu ticketów. Sprawdź wersję discord.js.'
                );
            }
        }
    });

    // =====================================================
    // SELECT MENU
    // =====================================================

    client.on('interactionCreate', async (interaction) => {

        if (!interaction.isStringSelectMenu()) return;

        if (interaction.customId !== 'ticket_select_menu') {
            return;
        }

        const type = interaction.values[0];

        if (!ticketTypes[type]) return;

        await interaction.showModal(
            createModal(type)
        );
    });

    // =====================================================
    // MODALE
    // =====================================================

    client.on('interactionCreate', async (interaction) => {

        if (!interaction.isModalSubmit()) return;

        if (!interaction.customId.startsWith('modal_')) {
            return;
        }

        try {

            await interaction.deferReply({
                ephemeral: true
            });

            const categoryKey =
                interaction.customId.replace('modal_', '');

            const categoryName =
                ticketTypes[categoryKey]?.label ||
                'Zgłoszenie';

            const channelName =
                safeChannelName(
                    interaction.user.username,
                    interaction.user.id
                );

            const existing =
                interaction.guild.channels.cache.find(
                    channel =>
                        channel.name === channelName
                );

            if (existing) {

                return interaction.editReply({
                    content:
                        `❌ Masz już otwarty ticket: ${existing}`
                });
            }

            const formData = [];

            interaction.fields.fields.forEach(field => {

                formData.push({
                    name: field.customId,
                    label:
                        fieldLabels[field.customId] ||
                        field.customId,
                    value: field.value
                });

            });

            // =================================================
            // TWORZENIE KANAŁU
            // =================================================

            const ticketChannel =
                await interaction.guild.channels.create({

                    name: channelName,

                    type: ChannelType.GuildText,

                    parent: KATEGORIA_ID,

                    topic:
                        `Ticket ${categoryName} | Otworzył: ${interaction.user.tag}`,

                    permissionOverwrites: [

                        {
                            id: interaction.guild.id,

                            deny: [
                                PermissionFlagsBits.ViewChannel
                            ]
                        },

                        {
                            id: interaction.user.id,

                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        },

                        {
                            id: ROLA_ADMIN_ID,

                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        }

                    ]
                });

            ticketCache.set(
                ticketChannel.id,
                {
                    owner: interaction.user,
                    category: categoryName,
                    formData,
                    createdAt: new Date(),
                    claimedBy: null
                }
            );

            // =================================================
            // WIADOMOŚĆ TICKETU
            // =================================================

            await ticketChannel.send({

                content:
                    `<@${interaction.user.id}> | <@&${ROLA_ADMIN_ID}>`,

                components: [
                    createTicketPanel(
                        interaction.user.id,
                        interaction.user.tag,
                        categoryName,
                        formData
                    )
                ],

                flags:
                    MessageFlags.IsComponentsV2
            });

            await interaction.editReply({

                content:
                    `✅ Ticket został utworzony: ${ticketChannel}`
            });

        } catch (error) {

            console.error(
                '❌ Błąd tworzenia ticketu:',
                error
            );

            const text =
                '❌ Wystąpił błąd podczas tworzenia ticketu. ' +
                'Sprawdź ID kategorii, ID roli, uprawnienia bota i wersję discord.js.';

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply({
                    content: text
                }).catch(() => {});

            } else {

                await interaction.reply({
                    content: text,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    // =====================================================
    // PRZYCISKI
    // =====================================================

    client.on('interactionCreate', async (interaction) => {

        if (!interaction.isButton()) return;

        if (
            ![
                'claim_ticket',
                'close_ticket'
            ].includes(interaction.customId)
        ) {
            return;
        }

        const data =
            ticketCache.get(
                interaction.channelId
            );

        // =================================================
        // PRZEJĘCIE
        // =================================================

        if (
            interaction.customId ===
            'claim_ticket'
        ) {

            if (!isAdmin(interaction.member)) {

                return interaction.reply({
                    content:
                        '❌ Tylko administracja może przejmować tickety.',
                    ephemeral: true
                });
            }

            if (data?.claimedBy) {

                return interaction.reply({
                    content:
                        `❌ Ticket został już przejęty przez <@${data.claimedBy.id}>.`,
                    ephemeral: true
                });
            }

            if (data) {
                data.claimedBy =
                    interaction.user;
            }

            return interaction.reply({
                content:
                    `📌 **Ticket został przejęty przez:** <@${interaction.user.id}>`
            });
        }

        // =================================================
        // ZAMKNIĘCIE
        // =================================================

        if (
            interaction.customId ===
            'close_ticket'
        ) {

            if (
                !isAdmin(interaction.member) &&
                data &&
                interaction.user.id !==
                    data.owner.id
            ) {

                return interaction.reply({
                    content:
                        '❌ Nie masz uprawnień do zamknięcia tego ticketu.',
                    ephemeral: true
                });
            }

            await interaction.reply(
                '🔒 Rozpoczęto zamykanie ticketu. Generuję transkrypt...'
            );

            // =================================================
            // TRANSKRYPT
            // =================================================

            let allMessages = [];

            let lastId;

            try {

                while (true) {

                    const options = {
                        limit: 100
                    };

                    if (lastId) {
                        options.before =
                            lastId;
                    }

                    const fetched =
                        await interaction.channel.messages.fetch(
                            options
                        );

                    if (!fetched.size) {
                        break;
                    }

                    allMessages.push(
                        ...fetched.values()
                    );

                    lastId =
                        fetched.last().id;
                }

            } catch (error) {

                console.error(
                    '❌ Błąd pobierania transkryptu:',
                    error
                );
            }

            allMessages.reverse();

            const header =
                '==================================================\n' +
                '                 BROBOX.PL\n' +
                '              TRANSKRYPT TICKETU\n' +
                '==================================================\n' +
                `Kanał: ${interaction.channel.name}\n` +
                `Data zamknięcia: ${new Date().toLocaleString('pl-PL')}\n\n`;

            const body =
                allMessages
                    .map(message => {

                        const time =
                            message.createdAt.toLocaleString(
                                'pl-PL'
                            );

                        const content =
                            message.content ||
                            '[Embed / Components / Załącznik]';

                        return (
                            `[${time}] ` +
                            `${message.author.tag}: ` +
                            content
                        );

                    })
                    .join(
                        '\n--------------------------------------------------\n'
                    );

            const attachment =
                new AttachmentBuilder(
                    Buffer.from(
                        header + body,
                        'utf8'
                    ),
                    {
                        name:
                            `transkrypt-${interaction.channel.name}.txt`
                    }
                );

            // =================================================
            // LOGI
            // =================================================

            const logsChannel =
                interaction.guild.channels.cache.get(
                    LOGI_KANAL_ID
                );

            if (logsChannel) {

                const logEmbed =
                    new EmbedBuilder()

                        .setColor(
                            KOLOR_HEX
                        )

                        .setTitle(
                            '📜 BroBox.pl | Zamknięcie ticketu'
                        )

                        .setDescription(
                            'Poniżej znajdują się informacje dotyczące zamkniętego zgłoszenia.'
                        )

                        .addFields(

                            {
                                name:
                                    '👤 Otwierający',

                                value:
                                    data
                                        ? `${data.owner.tag} (\`${data.owner.id}\`)`
                                        : 'Nieznany',

                                inline: true
                            },

                            {
                                name:
                                    '🔒 Zamknięty przez',

                                value:
                                    `${interaction.user.tag} (\`${interaction.user.id}\`)`,

                                inline: true
                            },

                            {
                                name:
                                    '📌 Przejęty przez',

                                value:
                                    data?.claimedBy
                                        ? data.claimedBy.tag
                                        : 'Nieprzejęty',

                                inline: true
                            },

                            {
                                name:
                                    '📂 Kategoria',

                                value:
                                    data?.category ||
                                    'Brak danych',

                                inline: true
                            },

                            {
                                name:
                                    '📅 Otwarcie',

                                value:
                                    data
                                        ? `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F>`
                                        : 'Brak',

                                inline: true
                            },

                            {
                                name:
                                    '⏱️ Zamknięcie',

                                value:
                                    `<t:${Math.floor(Date.now() / 1000)}:F>`,

                                inline: true
                            }

                        );

                if (
                    data?.formData?.length
                ) {

                    logEmbed.addFields({

                        name:
                            '📋 Dane formularza',

                        value:
                            data.formData
                                .map(
                                    field =>
                                        `**${field.label}:** ${field.value || 'Brak'}`
                                )
                                .join('\n')
                                .slice(0, 1024)

                    });
                }

                logEmbed.setTimestamp();

                await logsChannel.send({

                    embeds: [
                        logEmbed
                    ],

                    files: [
                        attachment
                    ]

                });
            }

            // =================================================
            // USUNIĘCIE KANAŁU
            // =================================================

            setTimeout(() => {

                interaction.channel
                    .delete()
                    .catch(() => {});

                ticketCache.delete(
                    interaction.channelId
                );

            }, 5000);
        }
    });
};
