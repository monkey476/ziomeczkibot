const { EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = (client) => {

    client.once('ready', () => {
        console.log('[Side Community Ziomeczki.gg] Moduł muzyczny (musico.js) został uruchomiony!');
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!play')) {
            const args = message.content.trim().split(' ');
            const url = args[1];

            const voiceChannel = message.member.voice.channel;

            if (!voiceChannel) {
                return message.reply({ content: '❌ Musisz być połączony z kanałem głosowym, aby użyć tej komendy!' });
            }

            if (!url) {
                return message.reply({ content: '❌ **Błędny format!** Użyj: `!play <bezpośredni_link_do_pliku_mp3>`' });
            }

            const loadingMsg = await message.reply({ content: '⏳ Łączenie z kanałem i odtwarzanie...' });

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                // Tworzenie odtwarzacza bezpośrednio z podanego linku do pliku audio
                const resource = createAudioResource(url);
                const player = createAudioPlayer();

                player.play(resource);
                connection.subscribe(player);

                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • ODTWARZACZ', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                    .setTitle('🎶 Odtwarzam utwór z linku:')
                    .setDescription(`[Kliknij, aby otworzyć źródło](${url})`)
                    .setColor('#9B59B6')
                    .addFields(
                        { name: '👤 Zlecone przez:', value: `> ${message.author}`, inline: true },
                        { name: '🔊 Kanał:', value: `> <#${voiceChannel.id}>`, inline: true }
                    )
                    .setFooter({ text: 'Życzymy miłego słuchania!', iconURL: client.user.displayAvatarURL() });

                await loadingMsg.edit({ content: null, embeds: [embed] });

                player.on(AudioPlayerStatus.Idle, () => {
                    connection.destroy();
                });

            } catch (error) {
                console.error('[Musico] Błąd odtwarzania:', error);
                await loadingMsg.edit({ content: '❌ Wystąpił błąd. Upewnij się, że podany link prowadzi bezpośrednio do pliku dźwiękowego (np. MP3).' });
            }
        }
    });
};
