const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder
} = require('discord.js');

// Pamięć tymczasowa bota do trzymania głosów i treści (czyści się po restarcie)
const propozycjeDb = new Map();

module.exports = (client) => {
    const KANAL_PROPOZYCJI_ID = '1482024939790925845';
    const ROLA_ADMIN_ID = '1542908457852600430';

    // 1. Zdarzenie: Przechwytywanie wiadomości i tworzenie Panelu Components V2
    client.on('messageCreate', async (message) => {
        if (message.channel.id !== KANAL_PROPOZYCJI_ID || message.author.bot) return;

        const trescPropozycji = message.content;

        // Błyskawiczne usunięcie oryginalnej wiadomości (z zabezpieczeniem przed błędem)
        await message.delete().catch(() => {});

        // --- BUDOWA KOMPONENTÓW V2 ---
        
        // 1. Tekst wewnątrz panelu
        const textDisplay = new TextDisplayBuilder()
            .setContent(`**Nowa propozycja od:** <@${message.author.id}>\n\n**Treść propozycji:**\n${trescPropozycji}\n\n_BroBox.pl • System Propozycji_`);

        // 2. Prawdziwa szara linia oddzielająca
        const separator = new SeparatorBuilder();

        // 3. Przyciski (umieszczone w środku panelu, a nie pod nim)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel('🟢 👍 Za (0)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel('🔴 👎 Przeciw (0)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_napisz').setLabel('🔵 ✏️ Napisz propozycję').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('prop_kto').setLabel('👥 Kto głosował').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Danger) 
        );

        // 4. Pakowanie wszystkiego w główny kontener
        const container = new ContainerBuilder()
            .addComponents(textDisplay, separator, row);

        try {
            // Wysłanie wiadomości jako Components V2, bez embedów
            const wyslanaWiadomosc = await message.channel.send({ 
                flags: MessageFlags.IsComponentsV2,
                components: [container] 
            });
            
            // Rejestracja propozycji w pamięci RAM bota (zapisujemy ID autora i treść do aktualizacji)
            propozycjeDb.set(wyslanaWiadomosc.id, {
                tak: new Set(),
                nie: new Set(),
                autor: message.author.id,
                tresc: trescPropozycji
            });
        } catch (err) {
            console.error('Błąd podczas wysyłania propozycji:', err);
        }
    });

    // 2. Zdarzenie: Obsługa przycisków
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || !interaction.customId.startsWith('prop_')) return;

        const propId = interaction.message.id;

        // --- A. USUWANIE PROPOZYCJI (Weryfikacja Roli) ---
        if (interaction.customId === 'prop_usun') {
            if (!interaction.member.roles.cache.has(ROLA_ADMIN_ID)) {
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

        // --- B. AKCJA: NAPISZ PROPOZYCJĘ ---
        if (interaction.customId === 'prop_napisz') {
            // Miejsce na obsłużenie modalboxa (ModalBuilder), jeśli chcesz go podpiąć pod ten system.
            return interaction.reply({
                content: 'Aby napisać propozycję, po prostu wyślij nową wiadomość tekstową na tym kanale!',
                ephemeral: true
            });
        }

        // Zabezpieczenie przed starymi propozycjami (sprzed restartu bota)
        if (!propozycjeDb.has(propId)) {
            return interaction.reply({ 
                content: '⚠️ Ta propozycja pochodzi z poprzedniej sesji. Głosowanie na nią jest już zamknięte.', 
                ephemeral: true 
            });
        }

        const głosy = propozycjeDb.get(propId);
        const userId = interaction.user.id;

        // --- C. PODGLĄD GŁOSUJĄCYCH ---
        if (interaction.customId === 'prop_kto') {
            let naTak = Array.from(głosy.tak).map(id => `<@${id}>`).join(', ');
            let naNie = Array.from(głosy.nie).map(id => `<@${id}>`).join(', ');

            if (naTak.length > 900) naTak = naTak.substring(0, 900) + '... (i inni)';
            if (naNie.length > 900) naNie = naNie.substring(0, 900) + '... (i inni)';

            const tekstTak = naTak || 'Brak głosów';
            const tekstNie = naNie || 'Brak głosów';

            return interaction.reply({
                content: `📊 **Lista głosujących:**\n\n**🟢 👍 Na TAK (${głosy.tak.size}):**\n${tekstTak}\n\n**🔴 👎 Na NIE (${głosy.nie.size}):**\n${tekstNie}`,
                ephemeral: true
            });
        }

        // --- D. LOGIKA GŁOSOWANIA (Zmiana głosów) ---
        if (interaction.customId === 'prop_tak') {
            if (głosy.tak.has(userId)) {
                return interaction.reply({ content: '❌ Twój głos na **TAK** jest już oddany.', ephemeral: true });
            }
            głosy.tak.add(userId);
            głosy.nie.delete(userId);
        }

        if (interaction.customId === 'prop_nie') {
            if (głosy.nie.has(userId)) {
                return interaction.reply({ content: '❌ Twój głos na **NIE** jest już oddany.', ephemeral: true });
            }
            głosy.nie.add(userId);
            głosy.tak.delete(userId);
        }

        // --- E. PRZELICZANIE LICZNIKÓW I AKTUALIZACJA KONTENERA V2 ---
        const ileTak = głosy.tak.size;
        const ileNie = głosy.nie.size;

        // Musimy na nowo zbudować widok, podając zaktualizowane dane przycisków
        const updatedTextDisplay = new TextDisplayBuilder()
            .setContent(`**Nowa propozycja od:** <@${głosy.autor}>\n\n**Treść propozycji:**\n${głosy.tresc}\n\n_BroBox.pl • System Propozycji_`);

        const updatedSeparator = new SeparatorBuilder();

        const zaktualizowanePrzyciski = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel(`🟢 👍 Za (${ileTak})`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel(`🔴 👎 Przeciw (${ileNie})`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_napisz').setLabel('🔵 ✏️ Napisz propozycję').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('prop_kto').setLabel('👥 Kto głosował').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Danger)
        );

        // Składamy zaktualizowany panel
        const updatedContainer = new ContainerBuilder()
            .addComponents(updatedTextDisplay, updatedSeparator, zaktualizowanePrzyciski);

        // Nadpisujemy cały panel w używając Components V2
        await interaction.update({ components: [updatedContainer] }).catch(console.error);
    });
};
