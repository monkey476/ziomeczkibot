const { EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

module.exports = (client) => {

    client.once('ready', async () => {
        console.log('[Side Community Ziomeczki.gg] Moduł muzyczny (musico.js) został pomyślnie uruchomiony!');
        
        // Automatyczna rejestracja komendy /play
        try {
            await client.application.commands.create({
                name: 'play',
                description: 'Odtwarza audio z filmu na YouTube na Twoim kanale głosowym',
                options: [
                    {
                        name: 'link',
                        type: 3, // 3 oznacza wartość typu STRING
                        description: 'Wklej link do filmu na YouTube',
                        required: true
                    }
                ]
            });
        } catch (err) {
            console.error('[Side Community Ziomeczki.gg] Błąd podczas rejestracji komendy /play:', err);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        // Ignorujemy interakcje, które nie są komendami /play
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'play') return;

        const url = interaction.options.getString('link');
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        // Sprawdzamy, czy gracz znajduje się na kanale głosowym
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Musisz być połączony z kanałem głosowym, aby użyć tej komendy!', ephemeral: true });
        }

        // Wydłużamy czas na odpowiedź, bo pobieranie danych z YT może zająć więcej niż 3 sekundy
        await interaction.deferReply();

        try {
            // Walidacja czy to na pewno link do YT
            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                return interaction.editReply({ content: '❌ Podaj poprawny link do YouTube!' });
            }

            // Tworzenie połączenia z kanałem głosowym gracza
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            // Pobieranie streamu i tworzenie odtwarzacza
            const stream = await play.stream(url);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            // Pobieranie informacji o filmie, żeby ładnie je wyświetlić w embedzie
            const videoInfo = await play.video_info(url);
            const video = videoInfo.video_details;

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • ODTWARZACZ', iconURL: interaction.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🎶 Odtwarzam teraz:')
                .setDescription(`**[${video.title}](${video.url})**`)
                .setColor('#9B59B6')
                .addFields(
                    { name: '👤 Zlecone przez:', value: `> ${interaction.user}`, inline: true },
                    { name: '🔊 Kanał:', value: `> <#${voiceChannel.id}>`, inline: true }
                )
                .setThumbnail(video.thumbnails[0].url)
                .setFooter({ text: 'Życzymy miłego słuchania!', iconURL: client.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

            // Kiedy utwór się skończy, bot automatycznie opuszcza kanał
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

        } catch (error) {
            console.error('[Musico] Błąd odtwarzania:', error);
            await interaction.editReply({ content: '❌ Wystąpił błąd podczas próby odtworzenia utworu. Sprawdź, czy link jest poprawny.' });
        }
    });
};
