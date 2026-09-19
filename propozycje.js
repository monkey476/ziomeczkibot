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

// =====================================================
// BAZA PROPOZYCJI
// =====================================================

const propozycjeDb = new Map();

// =====================================================
// KONFIGURACJA
// =====================================================

const KANAL_PROPOZYCJI_ID = '1482024939790925845';
const ROLA_ADMIN_ID = '1542908457852600430';

// 🟡 Firmowy kolor BroBox.pl
const KOLOR = 0xFFF275;


// =====================================================
// SPRAWDZANIE ADMINA
// =====================================================

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


// =====================================================
// TWORZENIE PANELU PROPOZYCJI
// =====================================================

function createProposalPanel(data) {

    const ileTak = data.tak.size;
    const ileNie = data.nie.size;

    const suma = ileTak + ileNie;

    const procentTak =
        suma === 0
            ? 0
            : Math.round((ileTak / suma) * 100);

    const procentNie =
        suma === 0
            ? 0
            : Math.round((ileNie / suma) * 100);


    // =================================================
    // PRZYCISKI
    // =================================================

    const buttons = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId('prop_tak')
            .setLabel(`Za (${ileTak} • ${procentTak}%)`)
            .setEmoji('👍')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('prop_nie')
            .setLabel(`Przeciw (${ileNie} • ${procentNie}%)`)
            .setEmoji('👎')
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId('prop_usun')
            .setLabel('Usuń')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Secondary)

    );


    // =================================================
    // COMPONENTS V2
    // =================================================

    const container = new ContainerBuilder()
        .setAccentColor(KOLOR)

        // -------------------------------------------------
        // NAGŁÓWEK
        // -------------------------------------------------

        .addTextDisplayComponents(

            new TextDisplayBuilder().setContent(
                '# 💡 Propozycja społeczności\n' +

                `**Autor:** <@${data.autorId}>\n` +

                '**Status:** 🟢 Głosowanie aktywne'
            )

        )

        // -------------------------------------------------
        // SEPARATOR
        // -------------------------------------------------

        .addSeparatorComponents(

            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(
                    SeparatorSpacingSize.Small
                )

        )

        // -------------------------------------------------
        // TREŚĆ
        // -------------------------------------------------

        .addTextDisplayComponents(

            new TextDisplayBuilder().setContent(
                '## 📝 Treść propozycji\n' +
                data.tresc
            )

        )

        // -------------------------------------------------
        // SEPARATOR
        // -------------------------------------------------

        .addSeparatorComponents(

            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(
                    SeparatorSpacingSize.Small
                )

        )

        // -------------------------------------------------
        // WYNIKI
        // -------------------------------------------------

        .addTextDisplayComponents(

            new TextDisplayBuilder().setContent(
                `### 📊 Wyniki głosowania\n\n` +

                `👍 **Za:** ${ileTak} (${procentTak}%)\n` +

                `👎 **Przeciw:** ${ileNie} (${procentNie}%)\n\n` +

                `👥 **Łącznie głosów:** ${suma}`
            )

        )

        // -------------------------------------------------
        // SEPARATOR
        // -------------------------------------------------

        .addSeparatorComponents(

            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(
                    SeparatorSpacingSize.Small
                )

        )

        // -------------------------------------------------
        // PRZYCISKI
        // -------------------------------------------------

        .addActionRowComponents(
            buttons
        );


    return container;
}


// =====================================================
// GŁÓWNY MODUŁ
// =====================================================

module.exports = (client) => {


    // =================================================
    // NOWA PROPOZYCJA
    // =================================================

    client.on(
        'messageCreate',
        async (message) => {

            // Ignorowanie botów
            if (message.author.bot) {
                return;
            }

            // Tylko kanał propozycji
            if (
                message.channel.id !==
                KANAL_PROPOZYCJI_ID
            ) {
                return;
            }

            const tresc =
                message.content.trim();


            // Pusta wiadomość
            if (!tresc) {
                return;
            }


            // =================================================
            // USUNIĘCIE ORYGINALNEJ WIADOMOŚCI
            // =================================================

            await message
                .delete()
                .catch(() => {});


            // =================================================
            // DANE PROPOZYCJI
            // =================================================

            const data = {

                // Osobne Sety dla głosów
                tak: new Set(),

                nie: new Set(),

                // ID autora — dzięki temu robimy prawdziwe @
                autorId: message.author.id,

                // Treść
                tresc: tresc

            };


            // =================================================
            // WYSŁANIE PANELU
            // =================================================

            try {

                const wyslanaWiadomosc =
                    await message.channel.send({

                        components: [
                            createProposalPanel(data)
                        ],

                        flags:
                            MessageFlags.IsComponentsV2

                    });


                // =================================================
                // ZAPIS DO PAMIĘCI
                // =================================================

                propozycjeDb.set(
                    wyslanaWiadomosc.id,
                    data
                );


            } catch (error) {

                console.error(
                    '❌ Błąd podczas wysyłania propozycji:',
                    error
                );

            }

        }
    );


    // =================================================
    // OBSŁUGA PRZYCISKÓW
    // =================================================

    client.on(
        'interactionCreate',
        async (interaction) => {

            if (!interaction.isButton()) {
                return;
            }


            // Tylko nasze przyciski
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
            // USUWANIE PROPOZYCJI
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


                // Usunięcie z pamięci
                propozycjeDb.delete(
                    proposalId
                );


                // Usunięcie wiadomości
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
            // POBRANIE PROPOZYCJI
            // =================================================

            const data =
                propozycjeDb.get(
                    proposalId
                );


            // Propozycja sprzed restartu
            if (!data) {

                return interaction.reply({

                    content:
                        '⚠️ Ta propozycja pochodzi sprzed restartu bota. Głosowanie jest już zamknięte.',

                    ephemeral:
                        true

                });

            }


            const userId =
                interaction.user.id;


            // =================================================
            // GŁOS ZA
            // =================================================

            if (
                interaction.customId ===
                'prop_tak'
            ) {

                // Jeśli już głosował ZA,
                // ponowne kliknięcie usuwa głos

                if (
                    data.tak.has(
                        userId
                    )
                ) {

                    data.tak.delete(
                        userId
                    );

                } else {

                    // Dodaj ZA
                    data.tak.add(
                        userId
                    );

                    // Usuń PRZECIW
                    data.nie.delete(
                        userId
                    );

                }

            }


            // =================================================
            // GŁOS PRZECIW
            // =================================================

            if (
                interaction.customId ===
                'prop_nie'
            ) {

                // Jeśli już głosował PRZECIW,
                // ponowne kliknięcie usuwa głos

                if (
                    data.nie.has(
                        userId
                    )
                ) {

                    data.nie.delete(
                        userId
                    );

                } else {

                    // Dodaj PRZECIW
                    data.nie.add(
                        userId
                    );

                    // Usuń ZA
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
