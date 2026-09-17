
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

// Pamięć tymczasowa głosów.
// Po restarcie bota głosy zostaną wyczyszczone.
const propozycjeDb = new Map();

module.exports = (client) => {

    const KANAL_PROPOZYCJI_ID = '1482024939790925845';
    const ROLA_ADMIN_ID = '1542908457852600430';

    // =====================================================
    // FUNKCJA TWORZĄCA NATYWNY PANEL COMPONENTS V2
    // =====================================================

    function stworzPanelPropozycji({
        autorTag,
        tresc,
        ileTak,
        ileNie
    }) {

        const suma = ileTak + ileNie;

        const procentTak = suma === 0
            ? 0
            : Math.round((ileTak / suma) * 100);

        const procentNie = suma === 0
            ? 0
            : Math.round((ileNie / suma) * 100);

        // Prawdziwe przyciski Discorda
        const przyciski = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId('prop_tak')
                .setLabel(`Za (${ileTak} - ${procentTak}%)`)
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('prop_nie')
                .setLabel(`Przeciw (${ileNie} - ${procentNie}%)`)
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId('prop_napisz')
                .setLabel('Napisz propozycję')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId('prop_usun')
                .setLabel('Usuń (Admin)')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Secondary)
        );

        // NATYWNY SEPARATOR DISCORDA
        const separator = new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small);

        // NATYWNY PANEL COMPONENTS V2
        const container = new ContainerBuilder()
            .setAccentColor(0x5865F2)

            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 💡 Propozycja społeczności\n\n` +
                    `**Autor:** ${autorTag}\n\n` +
                    `**Propozycja:**\n${tresc}\n\n` +
                    `Głosowanie: **${suma}** głosów`
                )
            )

            // Prawdziwa szara linia
            .addSeparatorComponents(separator)

            // Prawdziwe przyciski WEWNĄTRZ kontenera
            .addActionRowComponents(przyciski);

        return container;
    }

    // =====================================================
    // 1. PRZECHWYTYWANIE WIADOMOŚCI
    // =====================================================

    client.on('messageCreate', async (message) => {

        if (
            message.channel.id !== KANAL_PROPOZYCJI_ID ||
            message.author.bot
        ) return;

        const trescPropozycji = message.content.trim();

        if (!trescPropozycji) return;

        // Usuwamy oryginalną wiadomość użytkownika
        await message.delete().catch(() => {});

        try {

            const panel = stworzPanelPropozycji({
                autorTag: message.author.tag,
                tresc: trescPropozycji,
                ileTak: 0,
                ileNie: 0
            });

            // WYSYŁANIE COMPONENTS V2
            const wyslanaWiadomosc = await message.channel.send({
                components: [panel],
                flags: MessageFlags.IsComponentsV2
            });

            // Zapis propozycji
            propozycjeDb.set(wyslanaWiadomosc.id, {
                tak: new Set(),
                nie: new Set(),
                autorTag: message.author.tag,
                tresc: trescPropozycji
            });

        } catch (err) {

            console.error(
                '❌ Błąd podczas wysyłania propozycji:',
                err
            );

        }

    });

    // =====================================================
    // 2. OBSŁUGA PRZYCISKÓW
    // =====================================================

    client.on('interactionCreate', async (interaction) => {

        if (
            !interaction.isButton() ||
            !interaction.customId.startsWith('prop_')
        ) return;

        const propId = interaction.message.id;

        // =================================================
        // USUWANIE PROPOZYCJI
        // =================================================

        if (interaction.customId === 'prop_usun') {

            if (
                !interaction.member.roles.cache.has(ROLA_ADMIN_ID) &&
                !interaction.member.permissions.has('Administrator')
            ) {
                return interaction.reply({
                    content: '❌ Brak uprawnień. Tylko administracja może usuwać propozycje.',
                    ephemeral: true
                });
            }

            propozycjeDb.delete(propId);

            await interaction.message.delete().catch(() => {});

            return interaction.reply({
                content: '✅ Propozycja została pomyślnie usunięta.',
                ephemeral: true
            });

        }

        // =================================================
        // NAPISZ PROPOZYCJĘ
        // =================================================

        if (interaction.customId === 'prop_napisz') {

            return interaction.reply({
                content: '📝 Aby stworzyć nową propozycję, po prostu wyślij wiadomość na tym kanale.',
                ephemeral: true
            });

        }

        // =================================================
        // ZABEZPIECZENIE STARYCH PROPOZYCJI
        // =================================================

        if (!propozycjeDb.has(propId)) {

            return interaction.reply({
                content: '⚠️ Ta propozycja pochodzi z poprzedniej sesji. Głosowanie jest zamknięte.',
                ephemeral: true
            });

        }

        const danePropozycji = propozycjeDb.get(propId);
        const userId = interaction.user.id;

        // =================================================
        // GŁOS ZA
        // =================================================

        if (interaction.customId === 'prop_tak') {

            if (danePropozycji.tak.has(userId)) {

                return interaction.reply({
                    content: '❌ Twój głos na **ZA** jest już oddany.',
                    ephemeral: true
                });

            }

            danePropozycji.tak.add(userId);
            danePropozycji.nie.delete(userId);

        }

        // =================================================
        // GŁOS PRZECIW
        // =================================================

        if (interaction.customId === 'prop_nie') {

            if (danePropozycji.nie.has(userId)) {

                return interaction.reply({
                    content: '❌ Twój głos na **PRZECIW** jest już oddany.',
                    ephemeral: true
                });

            }

            danePropozycji.nie.add(userId);
            danePropozycji.tak.delete(userId);

        }

        // =================================================
        // AKTUALIZACJA PANELU
        // =================================================

        const zaktualizowanyPanel = stworzPanelPropozycji({
            autorTag: danePropozycji.autorTag,
            tresc: danePropozycji.tresc,
            ileTak: danePropozycji.tak.size,
            ileNie: danePropozycji.nie.size
        });

        try {

            await interaction.update({
                components: [zaktualizowanyPanel]
            });

        } catch (err) {

            console.error(
                '❌ Błąd podczas aktualizacji propozycji:',
                err
            );

        }

    });

};
