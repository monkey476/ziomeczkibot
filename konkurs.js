const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'giveaways_data.json');

function loadData() {
    try {
        if (!fs.existsSync(dbPath)) {
            const initialData = { giveaways: {} };
            fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        return { giveaways: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = (client) => {

    client.once('ready', () => {
        console.log('[Side Community Ziomeczki.gg] Moduł konkursów został pomyślnie uruchomiony!');
        
        setInterval(async () => {
            const db = loadData();
            const now = Date.now();

            for (const [messageId, gData] of Object.entries(db.giveaways)) {
                if (!gData.ended && now >= gData.endTime) {
                    gData.ended = true;
                    saveData(db);

                    try {
                        const channel = await client.channels.fetch(gData.channelId).catch(() => null);
                        if (!channel) continue;
                        const message = await channel.messages.fetch(messageId).catch(() => null);
                        if (!message) continue;

                        let winnerText = 'Brak uczestników spełniających warunki.';
                        if (gData.participants && gData.participants.length > 0) {
                            const winnerId = gData.participants[Math.floor(Math.random() * gData.participants.length)];
                            winnerText = `🎉 Zwycięzca: <@${winnerId}>! Gratulacje!`;
                        }

                        const oldEmbed = message.embeds[0];
                        const endedEmbed = EmbedBuilder.from(oldEmbed)
                            .setTitle('🎉 KONKURS ROZSTRZYGNIĘTY! 🎉')
                            .setColor('#E74C3C')
                            .addFields({ name: '🏆 Wynik', value: `> **${winnerText}**`, inline: false });

                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('join_giveaway')
                                .setLabel('Konkurs zakończony')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('🔒')
                                .setDisabled(true)
                        );

                        await message.edit({ embeds: [endedEmbed], components: [disabledRow] });
                        await channel.send({ content: `📢 Konkurs dobiegł końca! ${winnerText}` });

                    } catch (err) {
                        console.error('[Konkursy] Błąd podczas kończenia konkursu:', err);
                    }
                }
            }
        }, 10 * 1000);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!konkurs')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply({ content: '❌ Nie masz uprawnień Administratora do tworzenia konkursów!', ephemeral: true });
            }

            await message.delete().catch(() => {});

            const rawContent = message.content.replace('!konkurs', '').trim();
            const parts = rawContent.split('|');

            if (parts.length < 2) {
                return message.channel.send({ content: '❌ **Błędny format!** Przykład użycia:\n`!konkurs 01.08.2026 20:00 50b <:cash:1532691264527663104> na Kaucja Simulator | Wbicie na discorda ZIOMECZKI.GG / https://discord.gg/yuFaCRrdMD`' });
            }

            const leftSide = parts[0].trim().split(' ');
            const dateStr = leftSide[0]; 
            const timeStr = leftSide[1]; 
            const prize = leftSide.slice(2).join(' ');

            const rightPart = parts.slice(1).join('|');
            const rightSide = rightPart.split('/');
            const requirements = rightSide[0] ? rightSide[0].trim() : 'Brak wymagań';
            const inviteLink = rightSide.slice(1).join('/').trim();

            const [day, month, year] = dateStr.split('.').map(Number);
            const [hour, minute] = timeStr.split(':').map(Number);
            
            const endDate = new Date(year, month - 1, day, hour, minute, 0);
            const endTimeMs = endDate.getTime();

            const timestampUnix = Math.floor(endTimeMs / 1000);

            // Układ z rozdzielonymi ikonami/nagłówkami i wartościami w nowych linijkach
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • KONKURSY', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🎉 NOWY KONKURS! 🎉')
                .setDescription(`🎁 **Do wygrania:** ${prize} 🎁\n\n👇 *Kliknij zielony przycisk poniżej, aby wziąć udział!*`)
                .setColor('#F1C40F')
                .addFields(
                    { name: '⏳ Koniec:', value: `> <t:${timestampUnix}:R> (${timeStr})`, inline: false },
                    { name: '👑 Host:', value: `> ${message.member}`, inline: false },
                    { name: '📋 Wymagania:', value: `> ${requirements}`, inline: false },
                    ...(inviteLink ? [{ name: '🔗 Discord:', value: `> ${inviteLink}`, inline: false }] : []),
                    { name: '👥 Uczestnicy:', value: `> \`0\``, inline: false }
                )
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: `Powodzenia! • Dziś o ${timeStr}`, iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Weź udział')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

            const db = loadData();
            db.giveaways[sentMessage.id] = {
                channelId: message.channel.id,
                endTime: endTimeMs,
                participants: [],
                ended: false
            };
            saveData(db);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'join_giveaway') return;

        const db = loadData();
        const gData = db.giveaways[interaction.message.id];

        if (!gData) {
            return interaction.reply({ content: '❌ Nie znaleziono danych tego konkursu w bazie (prawdopodobnie bot był restartowany przed jego utworzeniem). Stwórz nowy konkurs.', ephemeral: true });
        }

        if (gData.ended || Date.now() >= gData.endTime) {
            return interaction.reply({ content: '❌ Ten konkurs już się zakończył!', ephemeral: true });
        }

        const userId = interaction.user.id;

        if (!gData.participants) gData.participants = [];

        if (gData.participants.includes(userId)) {
            gData.participants = gData.participants.filter(id => id !== userId);
            saveData(db);
            await updateEmbedParticipants(interaction.message, gData.participants.length);
            return interaction.reply({ content: '❌ Pomyślnie wypisano Cię z konkursu.', ephemeral: true });
        } else {
            gData.participants.push(userId);
            saveData(db);
            await updateEmbedParticipants(interaction.message, gData.participants.length);
            return interaction.reply({ content: '✅ **Sukces!** Bierzesz udział w konkursie. Powodzenia!', ephemeral: true });
        }
    });
};

async function updateEmbedParticipants(message, count) {
    try {
        const oldEmbed = message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);
        
        const fields = newEmbed.data.fields;
        for (let field of fields) {
            if (field.name.includes('Uczestnicy')) {
                field.value = `> \`${count}\``;
            }
        }

        await message.edit({ embeds: [newEmbed] });
    } catch (e) {
        console.error('Błąd aktualizacji licznika uczestników:', e);
    }
}
