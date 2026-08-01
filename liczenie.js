const { EmbedBuilder } = require('discord.js');

// --- KONFIGURACJA LICZENIA ---
const COUNTING_CHANNEL_ID = '1532453185413972038';

// Stan gry (przechowywany w pamięci bota)
let currentCount = 0;
let lastUserId = null;

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignorujemy boty oraz wiadomości spoza kanału liczenia
        if (message.author.bot || message.channel.id !== COUNTING_CHANNEL_ID) return;

        const content = message.content.trim();
        const number = parseInt(content, 10);

        // 1. SPRAWDZENIE CZY TO LICZBA (Brak literek / słów)
        if (isNaN(number) || content !== number.toString()) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`❌ **${message.author}**, na tym kanale można pisać **wyłącznie kolejne liczby**! (Twoja wiadomość została usunięta).`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }

        // 2. SPRAWDZENIE KOLEJNOŚCI (Czy to ta sama osoba napisała poprzednią liczbę?)
        if (message.author.id === lastUserId) {
            await message.delete().catch(() => {});
            const warn = await message.channel.send(`⚠️ **${message.author}**, nie możesz liczyć pod rząd! Musisz zaczekać, aż ktoś inny wpisze następną liczbę.`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }

        // 3. SPRAWDZENIE CZY LICZBA JEST POPRAWNA (Kolejna w kolejności)
        if (number === currentCount + 1) {
            // POPRAWNA LICZBA
            currentCount = number;
            lastUserId = message.author.id;

            // Dodajemy ładną, dyskretną reakcję potwierdzającą sukces
            await message.react('✅').catch(() => {});

            // Co np. 50 liczb wysyłamy specjalny, wyróżniony embed z gratulacjami
            if (currentCount % 50 === 0) {
                const milestoneEmbed = new EmbedBuilder()
                    .setTitle('🎉 NIESAMOWITY KROK MILOWY! 🎉')
                    .setDescription(`> Udało Wam się wspólnie doliczyć do **${currentCount}**! Oby tak dalej! 🚀`)
                    .setColor('#FFD700')
                    .setTimestamp();
                await message.channel.send({ embeds: [milestoneEmbed] });
            }

        } else {
            // BŁĘDNA LICZBA (Zepsuto liczenie!)
            const failedNumber = number;
            const expectedNumber = currentCount + 1;
            
            // Resetujemy liczenie
            currentCount = 0;
            lastUserId = null;

            await message.react('❌').catch(() => {});

            const failEmbed = new EmbedBuilder()
                .setAuthor({ name: 'ZIOMECZKI.GG • LICZENIE ZEPSUTE', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('💥 O NIE! KTOŚ POMYLIŁ LICZBĘ!')
                .setDescription(
                    `> **Gracz:** ${message.author}\n` +
                    `> **Oczekiwano:** \`${expectedNumber}\`, a podano: \`${failedNumber}\`\n\n` +
                    `🔴 *Gra została zresetowana od zera! Kto zaczyna od nowa z liczbą* \`1\`*?*`
                )
                .setColor('#E74C3C')
                .setTimestamp();

            await message.channel.send({ embeds: [failEmbed] });
        }
    });
};
