const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const propozycjeDb = new Map();

const KANAL_PROPOZYCJI_ID =
    '1482024939790925845';

const ROLA_ADMIN_ID =
    '1542908457852600430';

const KOLOR =
    0x5865F2;

function isAdmin(member) {

    return Boolean(

        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||

        member?.roles?.cache?.has(
            ROLA_ADMIN_ID
        )

    );
}

function createProposalPanel(data) {

    const total =
        data.tak.size +
        data.nie.size;

    const takPercent =
        total
            ? Math.round(
                data.tak.size /
                total *
                100
            )
            : 0;

    const niePercent =
        total
            ? Math.round(
                data.nie.size /
                total *
                100
            )
            : 0;

    // =====================================================
    // PRZYCISKI
    // =====================================================

    const buttons =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        'prop_tak'
                    )

                    .setLabel(
                        `Za (${data.tak.size} • ${takPercent}%)`
                    )

                    .setEmoji(
                        '👍'
                    )

                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        'prop_nie'
                    )

                    .setLabel(
                        `Przeciw (${data.nie.size} • ${niePercent}%)`
                    )

                    .setEmoji(
                        '👎'
                    )

                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        'prop_usun'
                    )

                    .setLabel(
                        'Usuń'
                    )

                    .setEmoji(
                        '🗑️'
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

            );

    // =====================================================
    // PANEL COMPONENTS V2
    // =====================================================

    return new ContainerBuilder()

        .setAccentColor(
            KOLOR
        )

        .addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(

                    '# 💡 Propozycja społeczności\n' +

                    `**Autor:** ${data.autorTag}\n` +

                    `**Status:** 🟢 Głosowanie aktywne\n\n` +

                    '## 📝 Treść propozycji\n' +

                    data.tresc

                )

        )

        .addSeparatorComponents(

            new SeparatorBuilder()

                .setDivider(true)

                .setSpacing(
                    SeparatorSpacingSize.Small
                )

        )

        .addTextDisplayComponents(

            new TextDisplayBuilder()
                .setContent(

                    `**Głosowanie:** ${total} głosów\n` +

                    `👍 Za: **${data.tak.size}** (${takPercent}%)\n` +

                    `👎 Przeciw: **${data.nie.size}** (${niePercent}%)`

                )

        )

        .addSeparatorComponents(

            new SeparatorBuilder()

                .setDivider(true)

                .setSpacing(
                    SeparatorSpacingSize.Small
                )

        )

        .addActionRowComponents(
            buttons
        );
}

module.exports = (client) => {

    // =====================================================
    // NOWA PROPOZYCJA
    // =====================================================

    client.on(
        'messageCreate',
        async (message) => {

            if (message.author.bot) {
                return;
            }

            if (
                message.channel.id !==
                KANAL_PROPOZYCJI_ID
            ) {
                return;
            }

            const tresc =
                message.content.trim();

            if (!tresc) {
                return;
            }

            // Usunięcie wiadomości użytkownika
            await message
                .delete()
                .catch(() => {});

            const data = {

                tak:
                    new Set(),

                nie:
                    new Set(),

                autorTag:
                    message.author.tag,

                tresc:
                    tresc

            };

            try {

                const sent =
                    await message.channel.send({

                        components: [
                            createProposalPanel(
                                data
                            )
                        ],

                        flags:
                            MessageFlags.IsComponentsV2

                    });

                propozycjeDb.set(
                    sent.id,
                    data
                );

            } catch (error) {

                console.error(
                    '❌ Błąd wysyłania propozycji:',
                    error
                );

            }

        }
    );

    // =====================================================
    // OBSŁUGA PRZYCISKÓW
    // =====================================================

    client.on(
        'interactionCreate',
        async (interaction) => {

            if (!interaction.isButton()) {
                return;
            }

            if (
                !interaction.customId.startsWith(
                    'prop_'
                )
            ) {
                return;
            }

            const proposalId =
                interaction.message.id;

            // =================================================
            // USUWANIE
            // =================================================

            if (
                interaction.customId ===
                'prop_usun'
            ) {

                if (
                    !isAdmin(
                        interaction.member
                    )
                ) {

                    return interaction.reply({

                        content:
                            '❌ Tylko administracja może usuwać propozycje.',

                        ephemeral:
                            true

                    });
                }

                propozycjeDb.delete(
                    proposalId
                );

                await interaction.message
                    .delete()
                    .catch(() => {});

                return interaction.reply({

                    content:
                        '✅ Propozycja została usunięta.',

                    ephemeral:
                        true

                });
            }

            // =================================================
            // POBRANIE DANYCH
            // =================================================

            const data =
                propozycjeDb.get(
                    proposalId
                );

            if (!data) {

                return interaction.reply({

                    content:
                        '⚠️ Ta propozycja pochodzi sprzed restartu bota. Głosowanie jest zamknięte.',

                    ephemeral:
                        true

                });
            }

            const userId =
                interaction.user.id;

            // =================================================
            // ZA
            // =================================================

            if (
                interaction.customId ===
                'prop_tak'
            ) {

                // Kliknięcie drugi raz
                // usuwa głos

                if (
                    data.tak.has(
                        userId
                    )
                ) {

                    data.tak.delete(
                        userId
                    );

                } else {

                    data.tak.add(
                        userId
                    );

                    data.nie.delete(
                        userId
                    );
                }
            }

            // =================================================
            // PRZECIW
            // =================================================

            if (
                interaction.customId ===
                'prop_nie'
            ) {

                if (
                    data.nie.has(
                        userId
                    )
                ) {

                    data.nie.delete(
                        userId
                    );

                } else {

                    data.nie.add(
                        userId
                    );

                    data.tak.delete(
                        userId
                    );
                }
            }

            // =================================================
            // AKTUALIZACJA PANELU
            // =================================================

            try {

                await interaction.update({

                    components: [
                        createProposalPanel(
                            data
                        )
                    ],

                    flags:
                        MessageFlags.IsComponentsV2

                });

            } catch (error) {

                console.error(
                    '❌ Błąd aktualizacji propozycji:',
                    error
                );

            }

        }
    );
};
