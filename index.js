const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 1. SERWER HTTP DLA RENDERA ---
// Render wymaga, aby aplikacja nasłuchiwała na porcie, inaczej ją wyłączy.
const app = express();

app.get('/', (req, res) => {
    res.send('Bot BroBox.pl jest online i działa poprawnie!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serwer HTTP dla Rendera uruchomiony na porcie ${port}`);
});

// --- 2. KONFIGURACJA BOTA DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// --- 3. ŁADOWANIE MODUŁÓW BROBOX.PL ---
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Pamięć tymczasowa bota do trzymania głosów (czyści się po restarcie)
const propozycjeDb = new Map();

module.exports = (client) => {
    const KANAL_PROPOZYCJI_ID = '1482024939790925845';
    const ROLA_ADMIN_ID = '1542908457852600430';

    // 1. Zdarzenie: Przechwytywanie wiadomości i tworzenie Embedu
    client.on('messageCreate', async (message) => {
        if (message.channel.id !== KANAL_PROPOZYCJI_ID || message.author.bot) return;

        const trescPropozycji = message.content;

        // Błyskawiczne usunięcie oryginalnej wiadomości (z zabezpieczeniem przed błędem)
        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: `Nowa propozycja od: ${message.author.tag}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(`**Treść propozycji:**\n${trescPropozycji}`)
            .setColor('#FEE75C') // Firmowy, żółty kolor
            .setTimestamp()
            .setFooter({ 
                text: 'BroBox.pl • System Propozycji', 
                iconURL: client.user.displayAvatarURL() 
            });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel('👍 Tak (0 - 0%)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel('👎 Nie (0 - 0%)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_kto').setLabel('👥 Kto głosował').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Danger) 
        );

        try {
            const wyslanaWiadomosc = await message.channel.send({ embeds: [embed], components: [row] });
            
            // Rejestracja propozycji w pamięci RAM bota
            propozycjeDb.set(wyslanaWiadomosc.id, {
                tak: new Set(),
                nie: new Set()
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

        // Zabezpieczenie przed starymi propozycjami (sprzed restartu bota)
        if (!propozycjeDb.has(propId)) {
            return interaction.reply({ 
                content: '⚠️ Ta propozycja pochodzi z poprzedniej sesji. Głosowanie na nią jest już zamknięte.', 
                ephemeral: true 
            });
        }

        const głosy = propozycjeDb.get(propId);
        const userId = interaction.user.id;

        // --- B. PODGLĄD GŁOSUJĄCYCH ---
        if (interaction.customId === 'prop_kto') {
            let naTak = Array.from(głosy.tak).map(id => `<@${id}>`).join(', ');
            let naNie = Array.from(głosy.nie).map(id => `<@${id}>`).join(', ');

            // Zabezpieczenie przed limitem znaków na Discordzie (2000 znaków)
            if (naTak.length > 900) naTak = naTak.substring(0, 900) + '... (i inni)';
            if (naNie.length > 900) naNie = naNie.substring(0, 900) + '... (i inni)';

            const tekstTak = naTak || 'Brak głosów';
            const tekstNie = naNie || 'Brak głosów';

            return interaction.reply({
                content: `📊 **Lista głosujących:**\n\n**👍 Na TAK (${głosy.tak.size}):**\n${tekstTak}\n\n**👎 Na NIE (${głosy.nie.size}):**\n${tekstNie}`,
                ephemeral: true
            });
        }

        // --- C. LOGIKA GŁOSOWANIA (Zmiana głosów) ---
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

        // --- D. PRZELICZANIE PROCENTÓW I AKTUALIZACJA WIDOKU ---
        const ileTak = głosy.tak.size;
        const ileNie = głosy.nie.size;
        const suma = ileTak + ileNie;

        const procentTak = suma === 0 ? 0 : Math.round((ileTak / suma) * 100);
        const procentNie = suma === 0 ? 0 : Math.round((ileNie / suma) * 100);

        const zaktualizowanePrzyciski = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prop_tak').setLabel(`👍 Tak (${ileTak} - ${procentTak}%)`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('prop_nie').setLabel(`👎 Nie (${ileNie} - ${procentNie}%)`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('prop_kto').setLabel('👥 Kto głosował').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('prop_usun').setLabel('🗑️ Usuń (Admin)').setStyle(ButtonStyle.Danger)
        );

        // Używamy .update(), aby Discord nie krzyczał "Interakcja nie powiodła się"
        await interaction.update({ components: [zaktualizowanePrzyciski] }).catch(console.error);
    });
};
require('./weryfikacja.js')(client);
require('./propozycje.js')(client);
require('./powitalnia.js')(client);
require('./tickety.js')(client);
require('./moderacja.js')(client);
require('./embedy.js')(client);

client.login(process.env.TOKEN || DISCORD_TOKEN);
