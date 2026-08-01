const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const VERIFIED_ROLE_ID = '1532411605592047636'; 
const UNVERIFIED_ROLE_ID = '1532514463972855858'; 

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content === '!setup-weryfikacja') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply({ content: '❌ Brak uprawnień do użycia tej komendy.', ephemeral: true });
            }

            await message.delete().catch(() => {});

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'SIDE COMMUNITY ZIOMECZKI.GG • SYSTEM OCHRONY', iconURL: message.guild.iconURL({ dynamic: true }) || null })
                .setTitle('🛡️ Weryfikacja Użytkownika')
                .setDescription(
                    `> Witaj na serwerze! Aby uzyskać pełny dostęp do kanałów, musisz przejść szybką weryfikację.\n\n` +
                    `Kliknij zielony przycisk poniżej, aby potwierdzić, że jesteś człowiekiem i uzyskać dostęp do serwera.`
                )
                .setColor('#2ECC71') 
                .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                .setFooter({ text: 'Ochrona przed botami • Side Community Ziomeczki.gg', iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Zweryfikuj się')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'verify_user') {
            try {
                await interaction.deferReply({ ephemeral: true });
                const member = interaction.member;
                const verifiedRole = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
                const unverifiedRole = interaction.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
                
                if (!verifiedRole) {
                    return interaction.editReply({ content: '❌ **Błąd Krytyczny:** Rola `Zweryfikowany` nie istnieje na serwerze!' });
                }

                if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    return interaction.editReply({ content: '⚠️ Jesteś już zweryfikowany!' });
                }

                await member.roles.add(verifiedRole);
                if (unverifiedRole && member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    await member.roles.remove(unverifiedRole);
                }
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Sukces!')
                    .setDescription('Pomyślnie zweryfikowano! Otrzymałeś pełny dostęp do serwera.')
                    .setColor('#2ECC71');

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Błąd podczas weryfikacji:', error);
                await interaction.editReply({ content: '❌ **Wystąpił błąd podczas nadawania ról!** Upewnij się, że rola bota jest WYŻEJ w hierarchii.' }).catch(() => {});
            }
        }
    });
};
