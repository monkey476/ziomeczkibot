const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder 
} = require('discord.js');

// Pamięć tymczasowa bota do trzymania głosów oraz treści (czyści się po restarcie)
const propozycjeDb = new Map();

module.exports = (client) => {
    const KANAL_PROPOZYCJI_ID = '1482024939790925845';
    const ROLA_ADMIN_ID = '1542908457852600430';

    // 1. Zdarzenie: Przechwytywanie wiadomości i tworzenie Panelu Components V2
    client.on('messageCreate', async (message) => {
        if (message.channel.id !== KANAL_PROPOZYCJI_ID || message.author.bot) return;

        const trescPropozycji = message.content;

        // Błyskawiczne usunięcie oryginalnej wiadomości
        await message.delete().catch(() => {});

        // Zamiast EmbedBuilder - natywne elementy Components V2
        const textDisplay = new TextDisplayBuilder()
            .setText(`**Nowa propozycja od: ${message.author.tag}**\n\n**Treść propozycji:**\n${trescPropozycji}`);

        const separator = new SeparatorBuilder();

        // Przyciski przeniesione do panelu
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel('🟢 👍 Za (0 - 0%)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel('🔴 👎 Przeciw (0 - 0%)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_napisz').setLabel('🔵 ✏️ Napisz propozycję').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Secondary) 
        );

        // Złożenie panelu w ContainerBuilder
        const container = new ContainerBuilder().addComponents(textDisplay, separator, row);

        try {
            const wyslanaWiadomosc = await message.channel.send({
                components: [container],
                flags: [MessageFlags.IsComponentsV2] // Ustawienie odpowiedniej flagi wysyłania jako Components V2
            });
            
            // Rejestracja propozycji w pamięci RAM bota wraz z jej pierwotną treścią, by móc ją odświeżać
            propozycjeDb.set(wyslanaWiadomosc.id, {
                tak: new Set(),
                nie: new Set(),
                autorTag: message.author.tag,
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

        // --- B. INFORMACJA - NAPISZ PROPOZYCJĘ ---
        if (interaction.customId === 'prop_napisz') {
            return interaction.reply({
                content: '📝 Aby stworzyć nową propozycję, po prostu wyślij zwykłą wiadomość na tym kanale!',
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

        const danePropozycji = propozycjeDb.get(propId);
        const userId = interaction.user.id;

        // --- C. LOGIKA GŁOSOWANIA (Zmiana głosów) ---
        if (interaction.customId === 'prop_tak') {
            if (danePropozycji.tak.has(userId)) {
                return interaction.reply({ content: '❌ Twój głos na **ZA** jest już oddany.', ephemeral: true });
            }
            danePropozycji.tak.add(userId);
            danePropozycji.nie.delete(userId);
        }

        if (interaction.customId === 'prop_nie') {
            if (danePropozycji.nie.has(userId)) {
                return interaction.reply({ content: '❌ Twój głos na **PRZECIW** jest już oddany.', ephemeral: true });
            }
            danePropozycji.nie.add(userId);
            danePropozycji.tak.delete(userId);
        }

        // --- D. PRZELICZANIE PROCENTÓW I AKTUALIZACJA KONTENERA ---
        const ileTak = danePropozycji.tak.size;
        const ileNie = danePropozycji.nie.size;
        const suma = ileTak + ileNie;

        const procentTak = suma === 0 ? 0 : Math.round((ileTak / suma) * 100);
        const procentNie = suma === 0 ? 0 : Math.round((ileNie / suma) * 100);

        // Przebudowa zawartości panelu ze zaktualizowanymi przyciskami
        const zaktualizowanyTekst = new TextDisplayBuilder()
            .setText(`**Nowa propozycja od: ${danePropozycji.autorTag}**\n\n**Treść propozycji:**\n${danePropozycji.tresc}`);
            
        const zaktualizowanySeparator = new SeparatorBuilder();

        const zaktualizowanePrzyciski = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel(`🟢 👍 Za (${ileTak} - ${procentTak}%)`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel(`🔴 👎 Przeciw (${ileNie} - ${procentNie}%)`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_napisz').setLabel('🔵 ✏️ Napisz propozycję').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Secondary)
        );

        // Składamy zaktualizowany panel Components V2
        const zaktualizowanyKontener = new ContainerBuilder()
            .addComponents(zaktualizowanyTekst, zaktualizowanySeparator, zaktualizowanePrzyciski);

        // Wysyłamy update całego kontenera, dzięki czemu Discord zaktualizuje i tekst, i przyciski płynnie w jednym panelu
        await interaction.update({ components: [zaktualizowanyKontener] }).catch(console.error);
    });
};
