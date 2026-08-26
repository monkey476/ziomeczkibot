const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

module.exports = (client) => {
    // Uzupełnione ID kategorii i roli administracji
    const kategoriaTicketowID = '1494425319862436031'; 
    const rolaAdministracjiID = '1291897682742218823'; 
    
    // Nasz firmowy kolorek
    const jasnyZolty = '#FFF275'; 

    // 1. Komenda do postawienia panelu (!setup-tickety)
    client.on('messageCreate', async (message) => {
        if (message.content === '!setup-tickety' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            
            const embed = new EmbedBuilder()
                .setColor(jasnyZolty)
                .setTitle('📩 CENTRUM POMOCY | BroBox.pl')
                .setDescription(
                    `> **Potrzebujesz pomocy, chcesz nawiązać współpracę lub zgłosić problem?**\n\n` +
                    `Wybierz odpowiednią kategorię z rozwijanego menu poniżej, a bot automatycznie utworzy dla Ciebie prywatny kanał do rozmowy z administracją.\n\n` +
                    `⚠️ *Prosimy o nieotwieranie ticketów bez wyraźnego powodu.*`
                )
                .setFooter({ 
                    text: 'BroBox.pl - System Zgłoszeń',
                    iconURL: message.guild.iconURL({ dynamic: true })
                });

            // Tworzymy rozwijane menu (Select Menu)
            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('Wybierz kategorię zgłoszenia...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Pomoc Ogólna')
                        .setDescription('Masz pytanie dotyczące serwera lub problem z kontem.')
                        .setEmoji('🆘')
                        .setValue('pomoc'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Współpraca')
                        .setDescription('Chcesz zostać naszym partnerem (YouTube, Twitch, Discord).')
                        .setEmoji('🤝')
                        .setValue('wspolpraca'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Zgłoszenie Gracza')
                        .setDescription('Ktoś łamie regulamin i chcesz to zgłosić.')
                        .setEmoji('⚠️')
                        .setValue('zgloszenie')
                );

            const komponenty = new ActionRowBuilder().addComponents(menu);

            // Usuwamy wiadomość z komendą i wysyłamy panel
            await message.delete().catch(() => {});
            await message.channel.send({ embeds: [embed], components: [komponenty] });
        }
    });

    // 2. Obsługa tworzenia ticketu po wybraniu opcji z menu
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
            const wybranaKategoria = interaction.values[0];
            const member = interaction.member;
            const guild = interaction.guild;

            // Resetujemy menu w panelu głównym (żeby nie zostawało na wybranej opcji)
            await interaction.deferUpdate();

            // Nazwa kanału w zależności od wyboru
            const nazwaKanalu = `ticket-${wybranaKategoria}-${member.user.username}`;

            try {
                // Tworzymy nowy kanał w podanej kategorii
                const kanalTicketu = await guild.channels.create({
                    name: nazwaKanalu,
                    type: ChannelType.GuildText,
                    parent: kategoriaTicketowID, 
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel], 
                        },
                        {
                            id: member.id, // Użytkownik, który stworzył
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: rolaAdministracjiID, // Administracja
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        }
                    ],
                });

                // Dyskretna informacja dla gracza, że ticket został stworzony
                await interaction.followUp({ 
                    content: `✅ Twój ticket został pomyślnie utworzony: <#${kanalTicketu.id}>`, 
                    ephemeral: true 
                });

                // Embed wewnątrz nowo utworzonego ticketu
                const ticketEmbed = new EmbedBuilder()
                    .setColor(jasnyZolty)
                    .setTitle(`🎫 Zgłoszenie: ${wybranaKategoria.toUpperCase()}`)
                    .setDescription(`Witaj <@${member.id}>!\nOpisz dokładnie swój problem lub sprawę. Ktoś z administracji <@&${rolaAdministracjiID}> odpowie najszybciej jak to możliwe.`)
                    .setFooter({ text: 'BroBox.pl - Aby zamknąć, kliknij przycisk poniżej.' });

                // Przycisk do zamykania ticketu
                const zamknijPrzycisk = new ButtonBuilder()
                    .setCustomId('zamknij_ticket')
                    .setLabel('Zamknij Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const ticketKomponenty = new ActionRowBuilder().addComponents(zamknijPrzycisk);

                // Wysyłamy powitanie na nowym kanale
                await kanalTicketu.send({ 
                    content: `<@${member.id}> | <@&${rolaAdministracjiID}>`, 
                    embeds: [ticketEmbed], 
                    components: [ticketKomponenty] 
                });

            } catch (error) {
                console.error('Błąd podczas tworzenia ticketu:', error);
                await interaction.followUp({ 
                    content: 'Wystąpił błąd podczas tworzenia kanału! Sprawdź, czy ID kategorii jest poprawne i czy bot ma uprawnienia zarządzania kanałami.', 
                    ephemeral: true 
                });
            }
        }

        // 3. Obsługa zamykania ticketu (przycisk z kłódką)
        if (interaction.isButton() && interaction.customId === 'zamknij_ticket') {
            const kanal = interaction.channel;
            
            await interaction.reply('🔒 Zamykanie ticketu za 5 sekund...');
            
            setTimeout(() => {
                kanal.delete().catch(err => console.error('Błąd przy usuwaniu kanału:', err));
            }, 5000);
        }
    });
};
