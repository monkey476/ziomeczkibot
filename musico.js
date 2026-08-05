const { EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

module.exports = (client) => {

    client.once('ready', () => {
        console.log('[Side Community Ziomeczki.gg] Moduł muzyczny (musico.js) z komendą !play został uruchomiony!');
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith('!play')) {
            const args = message.content.trim().split(' ');
            const url = args[1]; // Pobiera link wpisany po spacji

            const voiceChannel = message.member.voice.channel;

            if (!voiceChannel) {
                return message.reply({ content: '❌ Musisz być połączony z kanałem głosowym, aby użyć tej komendy!' });
            }

            if (!url) {
                return message.reply({ content: '❌ **Błędny format!** Użyj: `!play <link_youtube>`' });
            }

            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                return message.reply({ content: '❌ Podaj poprawny link do filmu na YouTube!' });
            }

            // Wysyłamy informację o ładowaniu, bo pobieranie z YT czasem zajmuje parę sekund
            const loadingMsg = await message.reply({ content: '⏳ Przetwarzanie linku i dołączanie do kanału...' });

            try {
                // Tworzenie połączenia z kanałem głosowym gracza
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                // Pobieranie strumienia i tworzenie odtwarzacza
                const stream = await play.stream(url);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                const player = createAudioPlayer();

                player.play(resource);
                connection.subscribe(player);

                // Pobieranie informacji o filmie, żeby ładnie je wyświetlić w embedzie
                const videoInfo = await play.video_info(url);
                const video = videoInfo.video_details;

                const embed = new EmbedBuilder()
                    .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • ODTWARZACZ', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                    .setTitle('🎶 Odtwarzam teraz:')
                    .setDescription(`**[${video.title}](${video.url})**`)
                    .setColor('#9B59B6')
                    .addFields(
                        { name: '👤 Zlecone przez:', value: `> ${message.author}`, inline: true },
                        { name: '🔊 Kanał:', value: `> <#${voiceChannel.id}>`, inline: true }
                    )
                    .setThumbnail(video.thumbnails[0].url)
                    .setFooter({ text: 'Życzymy miłego słuchania!', iconURL: client.user.displayAvatarURL() });

                // Zmieniamy wiadomość z "ładowaniem" na piękny embed
                await loadingMsg.edit({ content: null, embeds: [embed] });

                // Kiedy utwór się skończy, bot automatycznie opuszcza kanał
                player.on(AudioPlayerStatus.Idle, () => {
                    connection.destroy();
                });

            } catch (error) {
                console.error('[Musico] Błąd odtwarzania:', error);
                await loadingMsg.edit({ content: '❌ Wystąpił błąd podczas próby odtworzenia utworu. Sprawdź, czy link jest poprawny.' });
            }
        }
    });
};
