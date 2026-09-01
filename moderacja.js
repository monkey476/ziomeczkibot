const { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    MessageFlags 
} = require('discord.js');

module.exports = (client) => {
    // --- KONFIGURACJA RÓL I KANAŁÓW ---
    const role = {
        warn: '1540162521678221362',
        tempmute: '1540162523884683384',
        kick: '1540165382348869682',
        tempban: '1540165382734749746',
        ban: '1540165383372144700',
        all: '1495094192957817025'
    };
    
    const kanalOdwolanID = '1542546740719124561';
    const firmowyKolor = '#ED4245'; 

    const maUprawnienia = (member, wymaganaRola) => {
        return member.permissions.has(PermissionFlagsBits.Administrator) || 
               member.roles.cache.has(role.all) || 
               member.roles.cache.has(wymaganaRola);
    };

    // --- REJESTRACJA KOMEND SLASH ---
    client.on('ready', async () => {
        console.log(`Moduł moderacji załadowany dla BroBox.pl!`);
        try { await client.application.commands.set([]); } catch (err) {}

        const komendy = [
            new SlashCommandBuilder().setName('warn').setDescription('Ostrzega gracza')
                .addUserOption(opt => opt.setName('gracz').setDescription('Wybierz gracza').setRequired(true))
                .addStringOption(opt => opt.setName('powod').setDescription('Powód ostrzeżenia').setRequired(false)),
            new SlashCommandBuilder().setName('kick').setDescription('Wyrzuca gracza z serwera')
                .addUserOption(opt => opt.setName('gracz').setDescription('Wybierz gracza').setRequired(true))
                .addStringOption(opt => opt.setName('powod').setDescription('Powód wyrzucenia').setRequired(false)),
            new SlashCommandBuilder().setName('ban').setDescription('Banuje gracza na stałe')
                .addUserOption(opt => opt.setName('gracz').setDescription('Wybierz gracza').setRequired(true))
                .addStringOption(opt => opt.setName('powod').setDescription('Powód bana').setRequired(false)),
            new SlashCommandBuilder().setName('tempmute').setDescription('Tymczasowe wyciszenie gracza (minuty)')
                .addUserOption(opt => opt.setName('gracz').setDescription('Wybierz gracza').setRequired(true))
                .addIntegerOption(opt => opt.setName('czas').setDescription('Czas wyciszenia w minutach').setRequired(true))
                .addStringOption(opt => opt.setName('powod').setDescription('Powód wyciszenia').setRequired(false))
        ];

        client.guilds.cache.forEach(async (guild) => {
            await guild.commands.set(komendy);
        });
    });

    // --- OBSŁUGA KOMEND I PRZYCISKÓW ---
    client.on('interactionCreate', async (interaction) => {
        
        // 1. KOMENDY SLASH
        if (interaction.isChatInputCommand()) {
            const { commandName, options, member, guild } = interaction;
            const targetUser = options.getUser('gracz');
            const targetMember = guild.members.cache.get(targetUser.id);
            const powod = options.getString('powod') || 'Brak powodu';

            if (!targetMember) {
                return interaction.reply({ content: 'Nie znaleziono tego gracza na serwerze.', flags: MessageFlags.Ephemeral }).catch(console.error);
            }

            // --- BAN ---
            if (commandName === 'ban') {
                if (!maUprawnienia(member, role.ban)) return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral }).catch(console.error);

                try {
                    await targetMember.ban({ reason: `Zbanowany przez: ${member.user.tag} | Powód: ${powod}` });
                } catch (error) {
                    return interaction.reply({ content: '❌ **Błąd:** Nie mogłem zbanować tego gracza! Upewnij się, że rola bota jest wyżej w ustawieniach serwera.', flags: MessageFlags.Ephemeral }).catch(console.error);
                }

                await interaction.reply({ content: `✅ Zbanowano gracza **${targetUser.tag}**. Powód: ${powod}.` }).catch(console.error);

                const dmEmbed = new EmbedBuilder().setColor(firmowyKolor).setTitle('🔨 Zostałeś zbanowany na BroBox.pl').addFields({ name: 'Administrator', value: member.user.tag, inline: true },{ name: 'Powód', value: powod, inline: true }).setFooter({ text: 'Jeśli uważasz, że to błąd, użyj przycisku poniżej.' });
                const odwolajPrzycisk = new ButtonBuilder().setCustomId('przycisk_odwolanie_ban').setLabel('Odwołaj się od bana').setEmoji('📝').setStyle(ButtonStyle.Primary);
                const row = new ActionRowBuilder().addComponents(odwolajPrzycisk);
                try { await targetUser.send({ embeds: [dmEmbed], components: [row] }); } catch (err) {}
            }

            // --- TEMPMUTE ---
            if (commandName === 'tempmute') {
                if (!maUprawnienia(member, role.tempmute)) return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral }).catch(console.error);

                const czasMinuty = options.getInteger('czas');
                const czasMs = czasMinuty * 60 * 1000;

                try {
                    await targetMember.timeout(czasMs, `Wyciszony przez: ${member.user.tag} | Powód: ${powod}`);
                } catch (error) {
                    return interaction.reply({ content: '❌ **Błąd:** Nie mogłem wyciszyć tego gracza! Upewnij się, że rola bota jest wyżej w ustawieniach serwera.', flags: MessageFlags.Ephemeral }).catch(console.error);
                }

                await interaction.reply({ content: `✅ Wyciszono gracza **${targetUser.tag}** na **${czasMinuty} min**. Powód: ${powod}.` }).catch(console.error);

                const dmEmbed = new EmbedBuilder().setColor('#F1C40F').setTitle('🔇 Zostałeś wyciszony na BroBox.pl').addFields({ name: 'Czas trwania', value: `${czasMinuty} min`, inline: true },{ name: 'Administrator', value: member.user.tag, inline: true },{ name: 'Powód', value: powod, inline: false });
                try { await targetUser.send({ embeds: [dmEmbed] }); } catch (err) {}
            }

            // --- WARN ---
            if (commandName === 'warn') {
                if (!maUprawnienia(member, role.warn)) return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral }).catch(console.error);

                await interaction.reply({ content: `✅ Ostrzeżono gracza **${targetUser.tag}**. Powód: ${powod}.` }).catch(console.error);

                const dmEmbed = new EmbedBuilder().setColor('#FEE75C').setTitle('⚠️ Otrzymałeś ostrzeżenie na BroBox.pl').addFields({ name: 'Administrator', value: member.user.tag, inline: true },{ name: 'Powód', value: powod, inline: true });
                try { await targetUser.send({ embeds: [dmEmbed] }); } catch (err) {}
            }

            // --- KICK ---
            if (commandName === 'kick') {
                if (!maUprawnienia(member, role.kick)) return interaction.reply({ content: '❌ Nie masz uprawnień!', flags: MessageFlags.Ephemeral }).catch(console.error);

                try {
                    await targetMember.kick(`Wyrzucony przez: ${member.user.tag} | Powód: ${powod}`);
                } catch (error) {
                    return interaction.reply({ content: '❌ **Błąd:** Nie mogłem wyrzucić tego gracza! Upewnij się, że rola bota jest wyżej w ustawieniach serwera.', flags: MessageFlags.Ephemeral }).catch(console.error);
                }

                await interaction.reply({ content: `✅ Wyrzucono gracza **${targetUser.tag}**. Powód: ${powod}.` }).catch(console.error);

                const dmEmbed = new EmbedBuilder().setColor('#E67E22').setTitle('🚪 Zostałeś wyrzucony z BroBox.pl').addFields({ name: 'Administrator', value: member.user.tag, inline: true },{ name: 'Powód', value: powod, inline: true });
                try { await targetUser.send({ embeds: [dmEmbed] }); } catch (err) {}
            }
        }

        // 2. PRZYCISK ODWOŁANIA W PV
        if (interaction.isButton() && interaction.customId === 'przycisk_odwolanie_ban') {
            const formularz = new ModalBuilder()
                .setCustomId('modal_odwolanie_ban')
                .setTitle('Odwołanie od Bana');

            const poleTekstowe = new TextInputBuilder()
                .setCustomId('powod_odwolania')
                .setLabel('Dlaczego powinniśmy Cię odbanować?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Opisz dokładnie swoją sytuację...')
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true);

            formularz.addComponents(new ActionRowBuilder().addComponents(poleTekstowe));
            await interaction.showModal(formularz).catch(console.error);
        }

        // 3. WYSŁANIE FORMULARZA Z ODWOŁANIEM
        if (interaction.isModalSubmit() && interaction.customId === 'modal_odwolanie_ban') {
            const tekstOdwolania = interaction.fields.getTextInputValue('powod_odwolania');
            const kanalOdwolan = client.channels.cache.get(kanalOdwolanID);

            if (kanalOdwolan) {
                const embedOdwolania = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('📝 Nowe odwołanie od bana')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: 'Gracz', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
                        { name: 'Treść odwołania', value: tekstOdwolania, inline: false }
                    )
                    .setTimestamp();

                await kanalOdwolan.send({ embeds: [embedOdwolania] }).catch(console.error);
                await interaction.reply({ content: '✅ Twoje odwołanie zostało pomyślnie wysłane do administracji.', flags: MessageFlags.Ephemeral }).catch(console.error);
            }
        }
    });
};
