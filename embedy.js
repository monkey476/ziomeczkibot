const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignorujemy wiadomości od innych botów
        if (message.author.bot) return;

        if (message.content.startsWith('!stworz-embed')) {
            // Zabezpieczenie: komendy może użyć tylko Administrator
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Nie masz uprawnień do użycia tej komendy.');
            }

            // Usuwamy wywołanie komendy i dzielimy resztę tekstu przy użyciu znaku "|"
            const argumenty = message.content.replace('!stworz-embed', '').split('|');

            // Sprawdzamy, czy gracz podał dokładnie 3 części (tytuł, wiadomość, stopka)
            if (argumenty.length < 3) {
                return message.reply('❌ **Błąd!** Poprawne użycie:\n`!stworz-embed Tytuł | Wiadomość | Tytuł Stopki`\n*(Pamiętaj o znaku | pomiędzy tekstami!)*');
            }

            // Oczyszczamy teksty ze zbędnych spacji na końcach (trim)
            const tytul = argumenty[0].trim();
            const wiadomosc = argumenty[1].trim();
            const stopka = argumenty[2].trim();

            // Budowanie embeda
            const embed = new EmbedBuilder()
                .setColor('#FEE75C') // Firmowy czerwony kolor BroBox.pl
                .setTitle(tytul)
                .setDescription(wiadomosc)
                .setFooter({ 
                    text: stopka, 
                    iconURL: message.guild.iconURL() // Dodaje małe logo serwera w stopce
                })
                .setTimestamp(); // Automatycznie dodaje " • dzisiaj o HH:MM" tak jak na screenie

            // Wysyłanie embeda i usuwanie wiadomości z komendą
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(console.error); // Kasuje Twoją wiadomość "!stworz-embed..." z czatu
        }
    });
};
