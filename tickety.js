const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder // Dodano moduł do wysyłania plików .txt
} = require('discord.js');

module.exports = (client) => {
    const kategoriaTicketowID = '1494425319862436031'; 
    const rolaAdministracjiID = '1291897682742218823'; 
    const kanalLogowID = '1505560669326413985'; 
    
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

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('Wybierz kategorię zgłoszenia...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Pomoc Ogólna')
                        .setDescription('Masz pytanie dotyczące serwera lub ogólny problem.')
                        .setEmoji('🆘')
                        .setValue('pomoc'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Problemy z Kontem')
                        .setDescription('Problemy z logowaniem, hasłem lub utraconymi przedmiotami.')
                        .setEmoji('🔑')
                        .setValue('konto'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Współpraca')
                        .setDescription('Chcesz zostać naszym partnerem (YouTube, Twitch, Discord).')
                        .setEmoji('💼')
                        .setValue('wspolpraca'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Zgłoszenie Gracza')
                        .setDescription('Ktoś łamie regulamin i chcesz to zgłosić.')
                        .setEmoji('⚠️')
                        .setValue('zgloszenie'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Odwołanie od Bana')
                        .setDescription('Uważasz, że Twoja kara jest niesłuszna.')
                        .setEmoji('🔨')
                        .setValue('odwolanie'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Rekrutacja')
                        .setDescription('Chcesz dołączyć do zespołu naszego serwera.')
                        .setEmoji('📝')
                        .setValue('rekrutacja')
                );

            const komponenty = new ActionRowBuilder().addComponents(menu);

            await message.delete().catch(() => {});
            await message.channel.send({ embeds: [embed], components: [komponenty] });
        }
    });

    // 2. Obsługa tworzenia i przycisków ticketu
    client.on('interactionCreate', async (interaction) => {
        // --- TWORZENIE TICKETU ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
            const wybranaKategoria = interaction.values[0];
            const member = interaction.member;
            const guild = interaction.guild;

            await interaction.deferUpdate();

            const nazwaKanalu = `ticket-${wybranaKategoria}-${member.user.username}`;

            try {
                const kanalTicketu = await guild.channels.create({
                    name: nazwaKanalu,
                    type: ChannelType.GuildText,
                    parent: kategoriaTicketowID, 
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel], 
                        },
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: rolaAdministracjiID,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        }
                    ],
                });

                await interaction.followUp({ 
                    content: `✅ Twój ticket został pomyślnie utworzony: <#${kanalTicketu.id}>`, 
                    ephemeral: true 
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor(jasnyZolty)
                    .setTitle(`🎫 Zgłoszenie: ${wybranaKategoria.toUpperCase()}`)
                    .setDescription(`Witaj <@${member.id}>!\nOpisz dokładnie swój problem lub sprawę. Ktoś z administracji <@&${rolaAdministracjiID}> odpowie najszybciej jak to możliwe.`)
                    .setFooter({ text: 'BroBox.pl - Aby zamknąć, kliknij przycisk poniżej.' });

                const przejmijPrzycisk = new ButtonBuilder()
                    .setCustomId('przejmij_ticket')
                    .setLabel('Przejmij Ticket')
                    .setEmoji('👋')
                    .setStyle(ButtonStyle.Success);

                const zamknijPrzycisk = new ButtonBuilder()
                    .setCustomId('zamknij_ticket')
                    .setLabel('Zamknij Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const ticketKomponenty = new ActionRowBuilder().addComponents(przejmijPrzycisk, zamknijPrzycisk);

                await kanalTicketu.send({ 
                    content: `<@${member.id}> | <@&${rolaAdministracjiID}>`, 
                    embeds: [ticketEmbed], 
                    components: [ticketKomponenty] 
                });

                // --- LOG: OTWARCIE TICKETU ---
                const kanalLogow = guild.channels.cache.get(kanalLogowID);
                if (kanalLogow) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('🟢 Otwarto nowy ticket')
                        .addFields(
                            { name: 'Kategoria', value: wybranaKategoria.toUpperCase(), inline: true },
                            { name: 'Utworzył', value: `<@${member.id}>`, inline: true },
                            { name: 'Kanał', value: `<#${kanalTicketu.id}>`, inline: true }
                        )
                        .setTimestamp();
                    kanalLogow.send({ embeds: [logEmbed] });
                }

            } catch (error) {
                console.error('Błąd podczas tworzenia ticketu:', error);
                await interaction.followUp({ 
                    content: 'Wystąpił błąd podczas tworzenia kanału! Sprawdź uprawnienia bota.', 
                    ephemeral: true 
                });
            }
        }

        // --- OBSŁUGA PRZYCISKÓW W TICKECIE ---
        if (interaction.isButton()) {
            
            // 3. Przejmowanie ticketu
            if (interaction.customId === 'przejmij_ticket') {
                if (!interaction.member.roles.cache.has(rolaAdministracjiID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ 
                        content: '❌ Nie masz uprawnień, aby przejmować tickety!', 
                        ephemeral: true 
                    });
                }

                const przejetyPrzycisk = new ButtonBuilder()
                    .setCustomId('przejmij_ticket_disabled')
                    .setLabel(`Przejął: ${interaction.user.username}`)
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const zamknijPrzycisk = new ButtonBuilder()
                    .setCustomId('zamknij_ticket')
                    .setLabel('Zamknij Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger);

                const zaktualizowaneKomponenty = new ActionRowBuilder().addComponents(przejetyPrzycisk, zamknijPrzycisk);

                await interaction.update({ components: [zaktualizowaneKomponenty] });
                
                await interaction.channel.send({ 
                    content: `👋 <@${interaction.user.id}> przejął ten ticket i zaraz zajmie się Twoją sprawą!` 
                });

                // --- LOG: PRZEJĘCIE TICKETU ---
                const kanalLogow = interaction.guild.channels.cache.get(kanalLogowID);
                if (kanalLogow) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle('👋 Przejęto ticket')
                        .addFields(
                            { name: 'Kanał', value: `<#${interaction.channel.id}> (${interaction.channel.name})`, inline: true },
                            { name: 'Przejął', value: `<@${interaction.user.id}>`, inline: true }
                        )
                        .setTimestamp();
                    kanalLogow.send({ embeds: [logEmbed] });
                }
            }

            // 4. Zamykanie ticketu z pobieraniem wiadomości
            if (interaction.customId === 'zamknij_ticket') {
                const kanal = interaction.channel;
                await interaction.reply('🔒 Trwa generowanie transkryptu i zamykanie ticketu...');

                try {
                    // Pobieramy do 100 ostatnich wiadomości
                    const pobraneWiadomosci = await kanal.messages.fetch({ limit: 100 });
                    const wiadomosci = Array.from(pobraneWiadomosci.values()).reverse();

                    let transkryptTekst = `====================================================\n`;
                    transkryptTekst += ` TRANSKRYPT TICKETU: ${kanal.name}\n`;
                    transkryptTekst += ` UTWORZONO: ${kanal.createdAt.toLocaleString('pl-PL')}\n`;
                    transkryptTekst += `====================================================\n\n`;

                    const uczestnicySet = new Set();
                    let ktoPrzejal = "Brak (nie przejęto)";
                    let kiedyPrzejal = "-";

                    wiadomosci.forEach(msg => {
                        // Zbieranie uczestników (ignorujemy bota)
                        if (!msg.author.bot) {
                            uczestnicySet.add(msg.author.tag);
                        }

                        // Weryfikacja przejęcia po systemowej wiadomości bota
                        if (msg.author.bot && msg.content.includes('przejął ten ticket')) {
                            const wzmianka = msg.mentions.users.first();
                            ktoPrzejal = wzmianka ? wzmianka.username : "Ktoś z administracji";
                            kiedyPrzejal = msg.createdAt.toLocaleString('pl-PL');
                        }

                        // Dodawanie wiadomości do pliku txt
                        const dataFormat = msg.createdAt.toLocaleString('pl-PL');
                        const tresc = msg.content || (msg.embeds.length > 0 ? '[Wiadomość z Embedem]' : '[Załącznik]');
                        transkryptTekst += `[${dataFormat}] ${msg.author.username}: ${tresc}\n`;
                    });

                    const listaUczestnikow = uczestnicySet.size > 0 ? Array.from(uczestnicySet).join(', ') : "Brak odpowiedzi";

                    // Zapisujemy treść do pamięci jako plik .txt
                    const transkryptPlik = new AttachmentBuilder(Buffer.from(transkryptTekst, 'utf-8'), { name: `${kanal.name}-logi.txt` });

                    // --- LOG: ZAMKNIĘCIE TICKETU Z TRANSKRYPTEM ---
                    const kanalLogow = interaction.guild.channels.cache.get(kanalLogowID);
                    if (kanalLogow) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ED4245') // Czerwony
                            .setTitle(`📑 Zamknięto ticket: ${kanal.name}`)
                            .addFields(
                                { name: 'Czas trwania', value: `Otwarty: <t:${Math.floor(kanal.createdTimestamp / 1000)}:f>\nZamknięty: <t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
                                { name: 'Zarządzanie', value: `**Zamknął:** <@${interaction.user.id}>\n**Przejął:** ${ktoPrzejal} (${kiedyPrzejal})`, inline: false },
                                { name: 'Uczestnicy (Nicki)', value: listaUczestnikow, inline: false }
                            )
                            .setFooter({ text: 'BroBox.pl - Archiwum Ticketów' })
                            .setTimestamp();
                        
                        // Wysyłamy embeda z załączonym plikiem
                        await kanalLogow.send({ embeds: [logEmbed], files: [transkryptPlik] });
                    }

                    // Kasujemy kanał po 3 sekundach
                    setTimeout(() => {
                        kanal.delete().catch(err => console.error('Błąd przy usuwaniu kanału:', err));
                    }, 3000);

                } catch (error) {
                    console.error('Błąd podczas generowania transkryptu:', error);
                    interaction.channel.send('❌ Wystąpił błąd podczas zapisywania logów. Zamykam bez logów...');
                    setTimeout(() => {
                        kanal.delete().catch(() => {});
                    }, 3000);
                }
            }
        }
    });
};
