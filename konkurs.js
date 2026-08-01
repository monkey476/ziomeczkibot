const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- TUTAJ WPISZ ID SWOJEGO KANAŁU KONKURSOWEGO ---
const GIVEAWAY_CHANNEL_ID = '1532418596159095105'; 
const giveawayParticipants = new Map();

module.exports = (client) => {
    // 1. Odbieranie komend z wiadomości
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content.startsWith('!konkurs') && message.channel.id === GIVEAWAY_CHANNEL_ID) {
            
            // UWAGA: Usunięto message.delete() - wiadomość z komendą zostaje na czacie, brak bugów wizualnych!

            const args = message.content.slice(8).trim().split(/\s+/);
            
            let timeMs = 0;
            let prize = '';

            const dateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
            const timeRegex = /^(\d{1,2}):(\d{2})$/;

            // 1. Sprawdzanie czy podano datę DD.MM.YYYY HH:MM
            if (args.length >= 3 && dateRegex.test(args[0]) && timeRegex.test(args[1])) {
                const dateMatch = args[0].match(dateRegex);
                const timeMatch = args[1].match(timeRegex);

                const day = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10) - 1; 
                const year = parseInt(dateMatch[3], 10);
                const hour = parseInt(timeMatch[1], 10);
                const minute = parseInt(timeMatch[2], 10);

                const targetDate = new Date();
                targetDate.setFullYear(year, month, day);
                targetDate.setHours(hour, minute, 0, 0);

                timeMs = targetDate.getTime() - Date.now();
                prize = args.slice(2).join(' ');
            } 
            // 2. Sprawdzanie czy podano po prostu minuty
            else if (args.length >= 2 && /^\d+$/.test(args[0])) {
                const minutes = parseInt(args[0], 10);
                if (!isNaN(minutes)) {
                    timeMs = minutes * 60 * 1000;
                    prize = args.slice(1).join(' ');
                }
            }

            // OBSŁUGA BŁĘDÓW (Bot tylko odpowiada, nie psuje się)
            if (isNaN(timeMs) || timeMs === 0 || !prize) {
                const errReply = await message.reply(`❌ Błędny format!\nUżyj: \`!konkurs [minuty] [nagroda]\` LUB \`!konkurs [DD.MM.YYYY] [HH:MM] [nagroda]\`\nNp: \`!konkurs 01.08.2026 15:00 Gra XYZ\``);
                setTimeout(() => errReply.delete().catch(() => {}), 15000);
                return;
            }

            if (timeMs <= 0) {
                const errReply = await message.reply(`❌ Podana data jest w przeszłości! Ustaw przyszłą datę.`);
                setTimeout(() => errReply.delete().catch(() => {}), 10000);
                return;
            }

            if (timeMs > 2147483647) {
                const errReply = await message.reply(`❌ Maksymalny czas trwania to około 24 dni (ograniczenie hostingu). Podaj bliższą datę.`);
                setTimeout(() => errReply.delete().catch(() => {}), 10000);
                return;
            }

            // OBLICZANIE CZASU
            const endTime = Math.floor((Date.now() + timeMs) / 1000);

            // PIĘKNIUTKI EMBED STARTOWY
            const embed = new EmbedBuilder()
                .setAuthor({ name: '🎉 WIELKI KONKURS! 🎉', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle(`🎁 Do wygrania: **${prize}**`)
                .setDescription('👇 *Kliknij zielony przycisk poniżej, aby spróbować swojego szczęścia!*')
                .addFields(
                    { name: '👑 Host', value: `${message.author}`, inline: true },
                    { name: '⏳ Koniec', value: `<t:${endTime}:R> (<t:${endTime}:t>)`, inline: true },
                    { name: '👥 Uczestnicy', value: '`0`', inline: true }
                )
                .setColor('#FF007F') // Nowy, ładny, wibrujący kolor
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Życzymy powodzenia!', iconURL: client.user.displayAvatarURL() })
                .setTimestamp(endTime * 1000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Weź udział')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
            
            // ZAPIS DO PAMIĘCI
            giveawayParticipants.set(giveawayMsg.id, new Set());

            // LOGIKA ZAKOŃCZENIA KONKURSU
            setTimeout(async () => {
                const participantsSet = giveawayParticipants.get(giveawayMsg.id);
                const participants = Array.from(participantsSet || []);

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('join_giveaway')
                        .setLabel('Konkurs zakończony')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🛑')
                        .setDisabled(true)
                );

                const endedEmbed = new EmbedBuilder()
                    .setAuthor({ name: '🎊 KONKURS ZAKOŃCZONY 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                    .setTitle(`🎁 Nagroda: **${prize}**`)
                    .setColor('#2B2D31') // Ciemnoszary po zakończeniu
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Zakończono' })
                    .setTimestamp();

                if (participants.length === 0) {
                    endedEmbed.addFields(
                        { name: '👑 Host', value: `${message.author}`, inline: true },
                        { name: '👥 Uczestnicy', value: '`0`', inline: true },
                        { name: '🏆 Wynik', value: '❌ Nikt nie wziął udziału', inline: false }
                    );
                    await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                    await message.channel.send(`❌ Konkurs o **${prize}** zakończony, ale nikt nie wziął udziału!`);
                } else {
                    const winnerId = participants[Math.floor(Math.random() * participants.length)];
                    endedEmbed.addFields(
                        { name: '👑 Host', value: `${message.author}`, inline: true },
                        { name: '👥 Uczestnicy', value: `\`${participants.length}\``, inline: true },
                        { name: '🏆 Zwycięzca', value: `🎉 <@${winnerId}> 🎉`, inline: false }
                    );
                    await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                    await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**! 🏆\nZgłoś się do ${message.author} po odbiór nagrody.`);
                }

                giveawayParticipants.delete(giveawayMsg.id);
            }, timeMs);
        }
    });

    // 2. Obsługa przycisków
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'join_giveaway') {
            const giveawayMsgId = interaction.message.id;
            
            if (!giveawayParticipants.has(giveawayMsgId)) {
                return interaction.reply({ content: '❌ Ten konkurs już się zakończył lub bot został zrestartowany!', ephemeral: true });
            }

            const participantsSet = giveawayParticipants.get(giveawayMsgId);
            const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);

            if (participantsSet.has(interaction.user.id)) {
                // Jeśli gracz już był -> Odejmujemy go
                participantsSet.delete(interaction.user.id);
                
                // Aktualizujemy pole z uczestnikami
                originalEmbed.data.fields.forEach(field => {
                    if(field.name === '👥 Uczestnicy') field.value = `\`${participantsSet.size}\``;
                });
                
                await interaction.message.edit({ embeds: [originalEmbed] });
                return interaction.reply({ content: '🚪 Zrezygnowałeś z udziału w konkursie!', ephemeral: true });
            } else {
                // Jeśli gracz nowy -> Dodajemy go
                participantsSet.add(interaction.user.id);
                
                // Aktualizujemy pole z uczestnikami
                originalEmbed.data.fields.forEach(field => {
                    if(field.name === '👥 Uczestnicy') field.value = `\`${participantsSet.size}\``;
                });
                
                await interaction.message.edit({ embeds: [originalEmbed] });
                return interaction.reply({ content: '🎉 Dołączyłeś/aś do konkursu! Trzymamy kciuki!', ephemeral: true });
            }
        }
    });
};
