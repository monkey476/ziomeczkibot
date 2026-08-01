// --- KOMENDA KONKURSU Z WSPARCIEM DLA DAT (DD.MM.YYYY HH:MM) ---
  if (message.content.startsWith('!konkurs') && message.channel.id === GIVEAWAY_CHANNEL_ID) {
    const args = message.content.slice(8).trim().split(' ');
    
    let timeMs = 0;
    let prize = '';

    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const timeRegex = /^(\d{2}):(\d{2})$/;

    // SPRAWDZENIE CZY PODANO DATĘ W FORMACIE: DD.MM.YYYY HH:MM
    if (args.length >= 3 && dateRegex.test(args[0]) && timeRegex.test(args[1])) {
      const dateMatch = args[0].match(dateRegex);
      const timeMatch = args[1].match(timeRegex);

      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // Miesiące w JS liczymy od 0
      const year = parseInt(dateMatch[3], 10);
      const hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);

      // Bezpieczne tworzenie daty
      const targetDate = new Date();
      targetDate.setFullYear(year, month, day);
      targetDate.setHours(hour, minute, 0, 0);

      timeMs = targetDate.getTime() - Date.now();
      prize = args.slice(2).join(' ');
    } 
    // JEŚLI NIE DATA, TO MINUTY
    else {
      const minutes = parseInt(args[0], 10);
      if (!isNaN(minutes)) {
        timeMs = minutes * 60 * 1000;
        prize = args.slice(1).join(' ');
      }
    }

    // WERYFIKACJA BŁĘDÓW
    if (isNaN(timeMs) || timeMs === 0 || !prize) {
      const errReply = await message.reply('❌ Błędny format!\nUżyj: `!konkurs [minuty] [nagroda]` LUB `!konkurs [DD.MM.YYYY] [HH:MM] [nagroda]`\nNp: `!konkurs 01.08.2024 15:00 Gra XYZ`');
      setTimeout(() => errReply.delete().catch(() => {}), 10000);
      await message.delete().catch(() => {});
      return;
    }

    if (timeMs <= 0) {
      const errReply = await message.reply('❌ Podana data jest w przeszłości! Ustaw przyszłą datę.');
      setTimeout(() => errReply.delete().catch(() => {}), 5000);
      await message.delete().catch(() => {});
      return;
    }

    if (timeMs > 2147483647) {
      const errReply = await message.reply('❌ Maksymalny czas trwania konkursu to około 24 dni (ograniczenie Discord/Node.js bez bazy danych). Podaj bliższą datę.');
      setTimeout(() => errReply.delete().catch(() => {}), 7000);
      await message.delete().catch(() => {});
      return;
    }

    await message.delete().catch(() => {});

    const endTime = Math.floor((Date.now() + timeMs) / 1000);

    const embed = new EmbedBuilder()
      .setAuthor({ name: '🎊 NOWY KONKURS! 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
      .setTitle(`🎁 Do wygrania: **${prize}**`)
      .setDescription(
        `\n` +
        `> ⏳ **Koniec:** <t:${endTime}:R> (<t:${endTime}:t>)\n` +
        `> 👑 **Host:** ${message.author}\n` +
        `> 👥 **Uczestnicy:** \`0\`\n\n` +
        `👇 *Kliknij zielony przycisk poniżej, aby wziąć udział!*`
      )
      .setColor('#FFD700')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Powodzenia!', iconURL: client.user.displayAvatarURL() })
      .setTimestamp(endTime * 1000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_giveaway')
        .setLabel('Weź udział')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎉')
    );

    const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });
    giveawayParticipants.set(giveawayMsg.id, new Set());

    // Finał konkursu
    setTimeout(async () => {
      const participantsSet = giveawayParticipants.get(giveawayMsg.id);
      const participants = Array.from(participantsSet || []);

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('join_giveaway')
          .setLabel('Konkurs zakończony')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛑')
          .setDisabled(true)
      );

      const endedEmbed = new EmbedBuilder()
        .setAuthor({ name: '🎊 KONKURS ZAKOŃCZONY 🎊', iconURL: message.guild.iconURL({ dynamic: true }) || null })
        .setTitle(`🎁 Nagroda: **${prize}**`)
        .setColor('#2B2D31')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Zakończono' })
        .setTimestamp();

      if (participants.length === 0) {
        endedEmbed.setDescription(`\n> 👑 **Host:** ${message.author}\n> 👥 **Uczestnicy:** \`0\`\n\n❌ **Nikt nie wziął udziału w konkursie!**`);
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
        await message.channel.send(`❌ Konkurs o **${prize}** zakończony, ale nikt nie wziął udziału!`);
      } else {
        const winnerId = participants[Math.floor(Math.random() * participants.length)];
        endedEmbed.setDescription(`\n> 👑 **Host:** ${message.author}\n> 👥 **Uczestnicy:** \`${participants.length}\`\n\n🏆 **ZWYCIĘZCA:** <@${winnerId}>`);
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
        await message.channel.send(`🎉 Gratulacje <@${winnerId}>! Wygrałeś/aś: **${prize}**! 🏆 Zgłoś się do hosta po odbiór nagrody.`);
      }

      giveawayParticipants.delete(giveawayMsg.id);
    }, timeMs);

    return;
  }
