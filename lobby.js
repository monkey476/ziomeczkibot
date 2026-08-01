const { EmbedBuilder } = require('discord.js');

// --- KONFIGURACJA LOBBY / POWITAŃ ---
const WELCOME_CHANNEL_ID = '1533099949531729921'; 

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        try {
            const guild = member.guild;
            const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
            
            if (!channel) return;

            // Tworzenie pięknego, profesjonalnego Embedu powitalnego
            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `NOWY UŻYTKOWNIK NA POKŁADZIE!`, 
                    iconURL: guild.iconURL({ dynamic: true }) || null 
                })
                .setTitle(`Witaj na ${guild.name}! 🎉`)
                .setDescription(
                    `> Cieszymy się, że do nas dołączyłeś, ${member}!\n\n` +
                    `✨ **Co warto zrobić na starcie?**\n` +
                    `• Sprawdź kanał <#1532519461414895827> i przejdź weryfikację.\n` +
                    `• Zapoznaj się z regulaminem serwera, aby uniknąć nieporozumień.\n` +
                    `• Zajrzyj na kanały 4fun i baw się dobrze razem z nami!\n\n` +
                    `📊 **Jesteś naszym:** \`${guild.memberCount}\`. członkiem serwera!`
                )
                .setColor('#5865F2') // Nowoczesny fioletowo-niebieski kolor Discorda
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ 
                    text: `System powitań Ziomeczki.gg • ID: ${member.id}`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Wysłanie wiadomości na kanał
            await channel.send({ 
                content: `Witaj na serwerze, ${member}! 🚀`, 
                embeds: [embed] 
            });

        } catch (error) {
            console.error('Błąd podczas wysyłania wiadomości powitalnej:', error);
        }
    });
};
