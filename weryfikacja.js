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
                // Od razu łapiemy interakcję, żeby nie wygasła
                await interaction.deferReply({ ephemeral: true });

                const member = interaction.member;
                const guild = interaction.guild;
                
                // Fetchujemy role, żeby upewnić się, że nie ma problemu z cachem (pamięcią) Discorda
                const verifiedRole = await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null);
                const unverifiedRole = await guild.roles.fetch(UNVERIFIED_ROLE_ID).catch(() => null);
                
                if (!verifiedRole) {
                    return interaction.editReply({ content: `❌ **Błąd:** Nie znalazłem roli o ID \`${VERIFIED_ROLE_ID}\`. Czy na pewno istnieje?` });
                }

                if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    return interaction.editReply({ content: '⚠️ Jesteś już zweryfikowany i masz dostęp do serwera!' });
                }

                // Próbujemy dodać rolę zweryfikowanego
                await member.roles.add(verifiedRole);
                
                // Próbujemy usunąć rolę niezweryfikowanego, jeśli ją posiada
                if (unverifiedRole && member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    await member.roles.remove(unverifiedRole);
                }
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Sukces!')
                    .setDescription('Pomyślnie zweryfikowano! Rola `Niezweryfikowany` została zdjęta. Otrzymałeś pełny dostęp do serwera.')
                    .setColor('#2ECC71');

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Błąd podczas weryfikacji:', error);
                
                // Precyzyjna wiadomość o błędzie dla Ciebie
                await interaction.editReply({ 
                    content: `❌ **BŁĄD SYSTEMU:** Discord zablokował akcję nadania/zabrania roli.\n\n` +
                             `**Szczegóły błędu od Discorda:** \`${error.message}\`\n\n` +
                             `👉 **Rozwiązanie:** Wejdź w Ustawienia Serwera -> Role i przesuń rolę bota **WYŻEJ** niż rola "Gracz" i "Niezweryfikowany"! Upewnij się też, że bot ma uprawnienie "Zarządzanie Rolami".` 
                }).catch(() => {});
            }
        }
    });
};
