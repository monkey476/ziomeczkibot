
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = (client) => {
    const kanalPowitanID = '1291077819954364457';
    const kolorLowhub = '#65E65B';

    function stworzEmbedPowitalny(member) {
        const dataDolaczenia = member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
            : 'Właśnie teraz';

        const ikonaSerwera = member.guild.iconURL({
            extension: 'png',
            size: 256
        });

        const embed = new EmbedBuilder()
            .setColor(kolorLowhub)
            .setAuthor({
                name: `Witaj na LOWHUB.PL, ${member.user.username}!`,
                iconURL: member.user.displayAvatarURL({
                    extension: 'png',
                    size: 128
                })
            })
            .setThumbnail(
                member.user.displayAvatarURL({
                    extension: 'png',
                    size: 512
                })
            )
            .setDescription(
                `# 👋 Witamy na LOWHUB.PL!\n` +
                `Cześć <@${member.id}>! Miło, że jesteś z nami.\n\n` +
                `Rozejrzyj się po naszym Discordzie, poznaj społeczność ` +
                `i przygotuj się na **wielki start serwera w 2027 roku!** 🚀`
            )
            .addFields(
                {
                    name: '👥 Numer użytkownika',
                    value: `**${member.guild.memberCount}**`,
                    inline: true
                },
                {
                    name: '📅 Data dołączenia',
                    value: dataDolaczenia,
                    inline: true
                }
            )
            .setFooter({
                text: 'LOWHUB.PL • OFICJALNY DISCORD',
                ...(ikonaSerwera ? { iconURL: ikonaSerwera } : {})
            })
            .setTimestamp();

        return embed;
    }

    // =====================================================
    // POWITANIE NOWEGO UŻYTKOWNIKA
    // =====================================================

    client.on('guildMemberAdd', async (member) => {
        try {
            const kanal = await member.guild.channels
                .fetch(kanalPowitanID)
                .catch(() => null);

            if (!kanal || !kanal.isTextBased()) {
                return console.error(
                    '[LOWHUB.PL] Nie znaleziono kanału powitań.'
                );
            }

            await kanal.send({
                embeds: [stworzEmbedPowitalny(member)],
                allowedMentions: {
                    users: [member.id]
                }
            });

        } catch (error) {
            console.error(
                '[LOWHUB.PL] Błąd wysyłania powitania:',
                error
            );
        }
    });

    // =====================================================
    // TEST POWITALNI
    // =====================================================

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.content !== '!test-powitalnia') return;

        if (
            !message.member?.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            return message.reply(
                '❌ Nie masz uprawnień do użycia tej komendy.'
            );
        }

        try {
            const kanal = await message.guild.channels
                .fetch(kanalPowitanID)
                .catch(() => null);

            if (!kanal || !kanal.isTextBased()) {
                return message.reply(
                    '❌ Nie znaleziono kanału powitań LOWHUB.PL.'
                );
            }

            await kanal.send({
                embeds: [stworzEmbedPowitalny(message.member)],
                allowedMentions: {
                    users: [message.author.id]
                }
            });

            await message.reply(
                '✅ Testowe powitanie LOWHUB.PL zostało wysłane!'
            );

        } catch (error) {
            console.error(
                '[LOWHUB.PL] Błąd testu powitalni:',
                error
            );

            await message.reply(
                '❌ Nie udało się wysłać powitania. Sprawdź logi Rendera.'
            );
        }
    });
};
