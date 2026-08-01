const { EmbedBuilder } = require('discord.js');

// --- KONFIGURACJA KANAŁU OSTATNIEJ LITERY ---
const WORD_GAME_CHANNEL_ID = 'TUTAJ_WPISZ_ID_KANAŁU_DLA_GRY'; // Podmień na ID kanału

let lastWord = '';
let lastUserId = null;

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || message.channel.id !== WORD_GAME_CHANNEL_ID) return;

        const content = message.content.trim().toLowerCase();

        // 1. Sprawdzenie czy wpisano jedno słowo (bez spacji, cyfr i dziwnych znaków)
        if (!/^[a-ząćęłńóśźż]+$/.test(content)) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`❌ **${message.author}**, piszemy wyłącznie **pojedyncze słowa** (bez cyfr, spacji i znaków specjalnych)!`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }

        // 2. Sprawdzenie czy ta sama osoba pisze pod rząd
        if (message.author.id === lastUserId) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`⚠️ **${message.author}**, nie możesz pisać słów pod rząd! Poczekaj na innego gracza.`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }

        // Jeśli to pierwsze słowo w historii gry
        if (!lastWord) {
            lastWord = content;
            lastUserId = message.author.id;
            await message.react('✅').catch(() => {});
            
            const startEmbed = new EmbedBuilder()
                .setTitle('🔤 Gra w Ostatnią Literę rozpoczęta!')
                .setDescription(`Pierwsze słowo to: **${content.toUpperCase()}**\nKolejne słowo musi zaczynać się na literę: **\`${content.slice(-1).toUpperCase()}\`**`)
                .setColor('#3498DB');
            await message.channel.send({ embeds: [startEmbed] });
            return;
        }

        // 3. Sprawdzenie zasady ostatniej litery
        const requiredLetter = lastWord.slice(-1);
        const firstLetter = content.charAt(0);

        if (firstLetter !== requiredLetter) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`❌ **${message.author}**, słowo **"${content}"** musi zaczynać się na literę **\`${requiredLetter.toUpperCase()}\`** (od ostatniej litery słowa *"${lastWord}"*)!`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }

        // Słowo poprawne!
        lastWord = content;
        lastUserId = message.author.id;
        await message.react('✅').catch(() => {});

        // Co każde 25 słów wysyłamy ładne podsumowanie postępu
        // (możesz też zostawić samą reakcję, żeby nie śmiecić na kanale)
    });
};
