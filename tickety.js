
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

const KOLOR = 0x65E65B;
const KOLOR_HEX = '#65E65B';

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
        description: 'Dołącz do ekipy LOWHUB.PL.'
    }
};

function isAdmin(member) {
    return Boolean(
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
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

function createSeparator() {
    return new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);
}

// =====================================================
// PANEL WYBORU TICKETU
// =====================================================

function createTicketSetupPanel() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_menu')
        .setPlaceholder('🎫 Wybierz kategorię zgłoszenia...')
        .addOptions(
            Object.entries(ticketTypes).map(([value, data]) => ({
                label: data.label,
                description: data.description,
                value,
                emoji: data.emoji
            }))
        );

    const container = new ContainerBuilder()
        .setAccentColor(KOLOR)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# 🎫 LOWHUB.PL | CENTRUM POMOCY\n' +
                'Potrzebujesz pomocy? Jesteś w odpowiednim miejscu.\n\n' +
                'Wybierz kategorię, aby utworzyć **prywatny ticket** ' +
                'i skontaktować się z administracją LOWHUB.PL.'
            )
        )
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## 📌 Zasady zgłoszeń\n' +
                '🟢 **Jedno zgłoszenie** na użytkownika.\n' +
                '🟢 Opisz problem dokładnie i konkretnie.\n' +
                '🟢 W zgłoszeniach graczy dołącz dowody.\n' +
                '🟢 Nie oznaczaj administracji bez potrzeby.\n\n' +
                '-# LOWHUB.PL • SYSTEM ZGŁOSZEŃ'
            )
        )
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '**Wybierz temat zgłoszenia poniżej:**'
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu)
        );

    return container;
}

// =====================================================
// WIADOMOŚĆ OTWARTEGO TICKETU + ANKIETA + PRZYCISKI
// =====================================================

function createTicketPanel(userId, categoryName, formData) {
    const container = new ContainerBuilder()
        .setAccentColor(KOLOR)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 🎫 LOWHUB.PL | ${categoryName}\n` +
                `Witaj <@${userId}>!\n\n` +
                'Twoje zgłoszenie zostało utworzone. ' +
                'Administracja odpowie tutaj, gdy będzie dostępna.\n' +
                'W razie potrzeby możesz dopisać dodatkowe informacje.'
            )
        )
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## 📋 Ankieta zgłoszenia'
            )
        );

    for (const item of formData) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${item.label}**\n${item.value || 'Nie podano'}`
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
        .addSeparatorComponents(createSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '-# LOWHUB.PL • Zachowuj kulturę i współpracuj z administracją.'
            )
        )
        .addActionRowComponents(buttons);

    return container;
}

// =====================================================
// FORMULARZE
// =====================================================

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
            input('nick', 'Nick z Minecraft', 'Twój nick...'),
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
            input('nick', 'Nick z Minecraft', 'Twój nick...'),
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
            input('nick', 'Nick / nazwa', 'Twój nick lub projekt...'),
            input('link', 'Link do kanału / oferty', 'https://...'),
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
            input('nick', 'Twój nick', 'Twój nick...'),
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
            input('nick', 'Nick z Minecraft', 'Twój nick...'),
            input('powod_bana', 'Powód bana', 'Za co otrzymałeś bana?'),
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
            .setTitle('Rekrutacja LOWHUB.PL');

        modal.addComponents(
            input('nick', 'Nick z Minecraft', 'Twój nick...'),
            input('wiek', 'Wiek', 'Ile masz lat?'),
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

// =====================================================
// TRANSKRYPT ROZMOWY
// =====================================================

async function createTranscript(channel) {
    const messages = [];
    let lastId;

    while (true) {
        const options = { limit: 100 };

        if (lastId) {
            options.before = lastId;
        }

        const fetched = await channel.messages.fetch(options);

        if (!fetched.size) break;

        messages.push(...fetched.values());
        lastId = fetched.last().id;

        if (fetched.size < 100) break;
    }

    messages.reverse();

    const lines = [
        '==================================================',
        '                 LOWHUB.PL',
        '              TRANSKRYPT TICKETU',
        '==================================================',
        `Kanał: ${channel.name}`,
        `ID kanału: ${channel.id}`,
        `Data eksportu: ${new Date().toLocaleString('pl-PL')}`,
        '',
        'UWAGA: zapis obejmuje tekst wiadomości, podstawowe dane autorów,',
        'daty, treści embedów oraz adresy URL załączników.',
        ''
    ];

    for (const message of messages) {
        lines.push('--------------------------------------------------');
        lines.push(
            `[${message.createdAt.toLocaleString('pl-PL')}] ` +
            `${message.author.tag} (ID: ${message.author.id})`
        );

        if (message.content) {
            lines.push(`Treść: ${message.content}`);
        }

        for (const embed of message.embeds) {
            if (embed.title) lines.push(`Embed: ${embed.title}`);
            if (embed.description) {
                lines.push(`Opis embeda: ${embed.description}`);
            }

            for (const field of embed.fields || []) {
                lines.push(`${field.name}: ${field.value}`);
            }
        }

        if (message.attachments.size) {
            lines.push('Załączniki:');

            for (const attachment of message.attachments.values()) {
                lines.push(`- ${attachment.name}: ${attachment.url}`);
            }
        }

        if (message.stickers.size) {
            lines.push(
                'Naklejki: ' +
                [...message.stickers.values()]
                    .map(sticker => sticker.name)
                    .join(', ')
            );
        }

        if (!message.content && !message.embeds.length &&
            !message.attachments.size && !message.stickers.size) {
            lines.push('[Wiadomość zawierała komponenty lub inną zawartość]');
        }
    }

    return new AttachmentBuilder(
        Buffer.from(lines.join('\n'), 'utf8'),
        { name: `transkrypt-${channel.name}.txt` }
    );
}

// =====================================================
// BOT
// =====================================================

module.exports = (client) => {

    // PANEL STARTOWY
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.content !== '!setup-tickety') return;

        if (!isAdmin(message.member)) {
            return message.reply(
                '❌ Nie posiadasz uprawnień do użycia tej komendy.'
            );
        }

        try {
            await message.channel.send({
                components: [createTicketSetupPanel()],
                flags: MessageFlags.IsComponentsV2
            });

            if (message.deletable) {
                await message.delete().catch(() => {});
            }
        } catch (error) {
            console.error('Błąd panelu ticketów:', error);

            await message.reply(
                '❌ Nie udało się wysłać panelu ticketów. Sprawdź logi Rendera.'
            );
        }
    });

    // WYBÓR KATEGORII
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'ticket_select_menu') return;

        const type = interaction.values[0];
        if (!ticketTypes[type]) return;

        await interaction.showModal(createModal(type));
    });

    // WYSŁANIE FORMULARZA I UTWORZENIE KANAŁU
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('modal_')) return;

        try {
            await interaction.deferReply({ ephemeral: true });

            const categoryKey =
                interaction.customId.replace('modal_', '');

            const categoryName =
                ticketTypes[categoryKey]?.label || 'Zgłoszenie';

            const channelName = safeChannelName(
                interaction.user.username,
                interaction.user.id
            );

            const existing = interaction.guild.channels.cache.find(
                channel => channel.name === channelName
            );

            if (existing) {
                return interaction.editReply({
                    content: `❌ Masz już otwarty ticket: ${existing}`
                });
            }

            const formData = [];

            interaction.fields.fields.forEach(field => {
                formData.push({
                    name: field.customId,
                    label: fieldLabels[field.customId] || field.customId,
                    value: field.value
                });
            });

            const ticketChannel =
                await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: KATEGORIA_ID,
                    topic:
                        `LOWHUB.PL | ${categoryName} | OwnerID:${interaction.user.id}`,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
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

            ticketCache.set(ticketChannel.id, {
                owner: interaction.user,
                category: categoryName,
                formData,
                createdAt: new Date(),
                claimedBy: null
            });

            // Components V2: tekst i wzmianki umieszczamy w kontenerze.
            await ticketChannel.send({
                components: [
                    createTicketPanel(
                        interaction.user.id,
                        categoryName,
                        formData
                    )
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: {
                    users: [interaction.user.id]
                }
            });

            await interaction.editReply({
                content: `✅ Ticket został utworzony: ${ticketChannel}`
            });

        } catch (error) {
            console.error('Błąd tworzenia ticketu:', error);

            const text =
                '❌ Nie udało się utworzyć ticketu. ' +
                'Sprawdź ID kategorii, ID roli i uprawnienia bota.';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: text }).catch(() => {});
            } else {
                await interaction.reply({
                    content: text,
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    // PRZEJMOWANIE I ZAMYKANIE TICKETÓW
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (!['claim_ticket', 'close_ticket'].includes(interaction.customId)) {
            return;
        }

        const channel = interaction.channel;
        const data = ticketCache.get(interaction.channelId);

        // PRZEJĘCIE
        if (interaction.customId === 'claim_ticket') {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({
                    content: '❌ Tylko administracja może przejmować tickety.',
                    ephemeral: true
                });
            }

            if (data?.claimedBy) {
                return interaction.reply({
                    content:
                        `❌ Ticket jest już przejęty przez <@${data.claimedBy.id}>.`,
                    ephemeral: true
                });
            }

            if (data) data.claimedBy = interaction.user;

            const claimEmbed = new EmbedBuilder()
                .setColor(KOLOR)
                .setTitle('📌 Ticket przejęty')
                .setDescription(
                    `Administracja przejęła zgłoszenie.\n\n` +
                    `**Opiekun:** <@${interaction.user.id}>\n` +
                    `**Serwer:** LOWHUB.PL`
                )
                .setTimestamp();

            return interaction.reply({
                embeds: [claimEmbed]
            });
        }

        // ZAMKNIĘCIE
        if (interaction.customId === 'close_ticket') {
            if (
                !isAdmin(interaction.member) &&
                data &&
                interaction.user.id !== data.owner.id
            ) {
                return interaction.reply({
                    content: '❌ Nie masz uprawnień do zamknięcia tego ticketu.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const closedAt = new Date();
            let transcript;

            try {
                transcript = await createTranscript(channel);
            } catch (error) {
                console.error('Błąd tworzenia transkryptu:', error);

                return interaction.editReply(
                    '❌ Nie udało się wygenerować transkryptu. Kanał nie został usunięty.'
                );
            }

            const logsChannel =
                interaction.guild.channels.cache.get(LOGI_KANAL_ID);

            if (!logsChannel) {
                return interaction.editReply(
                    '❌ Nie znaleziono kanału logów. Ticket nie został usunięty, aby nie utracić rozmowy.'
                );
            }

            const ownerId =
                data?.owner?.id ||
                channel.topic?.match(/OwnerID:(\d+)/)?.[1];

            const ownerTag = data?.owner?.tag ||
                (ownerId ? `<@${ownerId}>` : 'Nieznany');

            const logEmbed = new EmbedBuilder()
                .setColor(KOLOR)
                .setTitle('📜 LOWHUB.PL | Zamknięcie ticketu')
                .setDescription(
                    'Zgłoszenie zostało zamknięte. Transkrypt rozmowy znajduje się w załączniku.'
                )
                .addFields(
                    {
                        name: '🎫 Kanał',
                        value: `#${channel.name}\nID: \`${channel.id}\``,
                        inline: true
                    },
                    {
                        name: '👤 Otwierający',
                        value: `${ownerTag}${ownerId ? `\nID: \`${ownerId}\`` : ''}`,
                        inline: true
                    },
                    {
                        name: '🔒 Zamknięty przez',
                        value: `${interaction.user.tag}\nID: \`${interaction.user.id}\``,
                        inline: true
                    },
                    {
                        name: '📌 Przejęty przez',
                        value: data?.claimedBy
                            ? `${data.claimedBy.tag}\nID: \`${data.claimedBy.id}\``
                            : 'Nieprzejęty',
                        inline: true
                    },
                    {
                        name: '📂 Kategoria',
                        value: data?.category || 'Brak danych',
                        inline: true
                    },
                    {
                        name: '🕒 Otwarcie',
                        value: data?.createdAt
                            ? `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F>`
                            : 'Nieznana data',
                        inline: true
                    },
                    {
                        name: '🔐 Zamknięcie',
                        value: `<t:${Math.floor(closedAt.getTime() / 1000)}:F>`,
                        inline: true
                    }
                )
                .setFooter({
                    text: 'LOWHUB.PL • SYSTEM TICKETÓW'
                })
                .setTimestamp(closedAt);

            if (data?.formData?.length) {
                const formularz = data.formData
                    .map(item => `**${item.label}:** ${item.value || 'Brak'}`)
                    .join('\n')
                    .slice(0, 1024);

                logEmbed.addFields({
                    name: '📋 Dane formularza',
                    value: formularz || 'Brak danych'
                });
            }

            try {
                await logsChannel.send({
                    embeds: [logEmbed],
                    files: [transcript]
                });
            } catch (error) {
                console.error('Błąd wysyłania logów:', error);

                return interaction.editReply(
                    '❌ Nie udało się wysłać logów. Ticket nie został usunięty.'
                );
            }

            await interaction.editReply(
                '🔒 Ticket zamknięty. Transkrypt został wysłany do logów.'
            );

            setTimeout(async () => {
                await channel.delete('Ticket zamknięty — LOWHUB.PL')
                    .catch(error => console.error('Błąd usuwania kanału:', error));

                ticketCache.delete(channel.id);
            }, 5000);
        }
    });
};
