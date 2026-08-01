const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// --- KONFIGURACJA ---
const GIVEAWAY_CHANNEL_ID = '1532418596159095105'; 

// NOWE ZARĄBISTE LOGO ZIOMECZKÓW:
const ZIOMECZKI_LOGO_URL = 'https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeczkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&'; 

const giveawayParticipants = new Map();

module.exports = (client) => {
    // 1. Odbieranie komend z wiadomości
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content.startsWith('!konkurs') && message.channel.id === GIVEAWAY_CHANNEL_ID) {
            
            const args = message.content.slice(8).trim().split(/\s+/);
            
            let timeMs = 0;
            let rawPrizeText = '';

            const dateRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
            const timeRegex = /^(\d{1,2}):(\d{2})$/;

            // Sprawdzanie czy podano datę DD.MM.YYYY HH:MM
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
                rawPrizeText = args.slice(2).join(' ');
            } 
            // Sprawdzanie czy podano po prostu minuty
            else if (args.length >= 2 && /^\d+$/.test(args[0])) {
                const minutes = parseInt(args[0], 10);
                if (!isNaN(minutes)) {
                    timeMs = minutes * 60 * 1000;
                    rawPrizeText = args.slice(1).join(' ');
                }
            }

            if (isNaN(timeMs) || timeMs === 0 || !rawPrizeText) {
                const errReply = await message.reply(`❌ Błędny format!\nUżyj: \`!konkurs [minuty] [nagroda] | [wymagania] / [discord]\` LUB \`!konkurs [DD.MM.YYYY] [HH:MM] [nagroda]\`\nNp: \`!konkurs 01.08.2026 19:00 1B | Zostaw suba / discord.gg/ziomeczki\``);
                setTimeout(() => errReply.delete().catch(() => {}), 15000);
                return;
            }

            if (timeMs <= 0) {
                const errReply = await message.reply(`❌ Podana data jest w przeszłości! Ustaw przyszłą datę.`);
                setTimeout(() => errReply.delete().catch(() => {}), 10000);
                return;
            }

            if (timeMs > 2147483647) {
                const errReply = await message.reply(`❌ Maksymalny czas trwania to około 24 dni. Podaj bliższą datę.`);
                setTimeout(() => errReply.delete().catch(() => {}), 10000);
                return;
            }

            // ODDZIELANIE NAGRODY, WYMAGAŃ (|) I DISCORDA (/)
            let prize = rawPrizeText;
            let requirements = '';
            let discord = '';

            if (rawPrizeText.includes('|')) {
                const parts = rawPrizeText.split('|');
                prize = parts[0].trim();
                let rest = parts.slice(1).join('|').trim(); // W razie użycia więcej niż jednego "|"

                if (rest.includes('/')) {
                    const subParts = rest.split('/');
                    requirements = subParts[0].trim();
                    discord = subParts.slice(1).join('/').trim();
                } else {
                    requirements = rest;
                }
            } else if (rawPrizeText.includes('/')) {
                // Jeśli ktoś wpisał tylko ukośnik bez pionowej kreski
                const parts = rawPrizeText.split('/');
                prize = parts[0].trim();
                discord = parts.slice(1).join('/').trim();
            }

            const endTime = Math.floor((Date.now() + timeMs) / 1000);

            // DYNAMICZNE BUDOWANIE OPISU (Ukrywa puste wartości)
            let embedDesc = `\n> ⏳ **Koniec:** <t:${endTime}:R> (<t:${endTime}:t>)\n> 👑 **Host:** ${message.author}\n`;
            if (requirements) embedDesc += `> 📋 **Wymagania:** ${requirements}\n`;
            if (discord) embedDesc += `> 🔗 **Discord:** ${discord}\n`;
            embedDesc += `> 👥 **Uczestnicy:** \`0\`\n\n👇 *Kliknij zielony przycisk poniżej, aby wziąć udział!*`;

            const embed = new EmbedBuilder()
                .setAuthor({ name: '🎊 NOWY KONKURS! 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle(`🎁 Do wygrania: **${prize}**`)
                .setDescription(embedDesc)
                .setColor('#FFD700')
                .setThumbnail(ZIOMECZKI_LOGO_URL) 
                .setFooter({ text: 'Powodzenia!', iconURL: client.user.displayAvatarURL() })
                .setTimestamp(endTime * 1000);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Weź udział')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
            
            giveawayParticipants.set(giveawayMsg.id, new Set());

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
                    .setColor('#2B2D31')
                    .setThumbnail(ZIOMECZKI_LOGO_URL) 
                    .setFooter({ text: 'Zakończono' })
                    .setTimestamp();

                // DYNAMICZNE BUDOWANIE OPISU ZAKOŃCZONEGO KONKURSU
                let endedDesc = `\n> 👑 **Host:** ${message.author}\n`;
                if (requirements) endedDesc += `> 📋 **Wymagania:** ${requirements}\n`;
                if (discord) endedDesc += `> 🔗 **Discord:** ${discord}\n`;

                if (participants.length === 0) {
                    endedEmbed.setDescription(endedDesc + `> 👥 **Uczestnicy:** \`0\`\n\n❌ **Nikt nie wziął udziału w konkursie!**`);
                    await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                    await message.channel.send(`❌ Konkurs o **${prize}** zakończony, ale nikt nie wziął udziału!`);
                } else {
                    const winnerId = participants[Math.floor(Math.random() * participants.length)];
                    endedEmbed.setDescription(endedDesc + `> 👥 **Uczestnicy:** \`${participants.length}\`\n\n🏆 **ZWYCIĘZCA:** <@${winnerId}>`);
                    await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                    await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**! 🏆 Zgłoś się do hosta po odbiór nagrody.`);
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
                return interaction.reply({ content: 'Ten konkurs już się zakończył lub nastąpił restart bota!', ephemeral: true });
            }

            const participantsSet = giveawayParticipants.get(giveawayMsgId);

            if (participantsSet.has(interaction.user.id)) {
                participantsSet.delete(interaction.user.id);
                
                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                originalEmbed.setDescription(originalEmbed.data.description.replace(/> 👥 \*\*Uczestnicy:\*\* \`\d+\`/, `> 👥 **Uczestnicy:** \`${participantsSet.size}\``));
                await interaction.message.edit({ embeds: [originalEmbed] });

                return interaction.reply({ content: 'Wyszedłeś/aś z konkursu!', ephemeral: true });
            } else {
                participantsSet.add(interaction.user.id);
                
                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
                originalEmbed.setDescription(originalEmbed.data.description.replace(/> 👥 \*\*Uczestnicy:\*\* \`\d+\`/, `> 👥 **Uczestnicy:** \`${participantsSet.size}\``));
                await interaction.message.edit({ embeds: [originalEmbed] });

                return interaction.reply({ content: 'Dołączyłeś/aś do konkursu! 🎉', ephemeral: true });
            }
        }
    });
};
