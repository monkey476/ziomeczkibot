```js
    const container = new ContainerBuilder()
        .setAccentColor(GREEN)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# ${BRAND} • KONKURS`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**🎁 Nagroda:** ${prize}\n` +
                `👥 **Uczestnicy:** ${participantCount}\n` +
                `🏆 **Zwycięzcy:** ${winnerCount}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                ended
                    ? (
                        `### 🏁 Konkurs zakończony\n` +
                        (
                            winners.length
                                ? `**Wylosowani:** ${winners.map(id => `<@${id}>`).join(", ")}`
                                : "Brak uczestników, nie udało się wyłonić zwycięzcy."
                        )
                    )
                    : (
                        `**🏁 Koniec:** <t:${Math.floor(endsAt / 1000)}:F>\n` +
                        `**⌛ Pozostały czas:** ${timestamp(endsAt)}`
                    )
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${JOIN_ID}:${giveaway.message_id}`)
                    .setLabel(ended ? "Konkurs zakończony" : "Weź udział")
                    .setEmoji(ended ? "🏁" : "🎉")
                    .setStyle(
                        ended ? ButtonStyle.Secondary : ButtonStyle.Success
                    )
                    .setDisabled(ended)
            )
        );

    return [container];
}

async function refreshGiveaway(giveaway, ended = false) {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased() || !channel.messages) return;

    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!message) return;

    const count = await getEntryCount(giveaway.message_id);

    await message.edit({
        components: buildCard(giveaway, count, ended),
        flags: MessageFlags.IsComponentsV2,
    }).catch(error => {
        console.error("[KONKURSY] Nie udało się odświeżyć wiadomości:", error.message);
    });
}

async function drawWinners(giveaway) {
    const entries = await pool.query(
        `SELECT user_id FROM giveaway_entries WHERE giveaway_id = $1`,
        [giveaway.message_id]
    );

    const ids = entries.rows.map(row => row.user_id);

    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const winners = ids.slice(0, Number(giveaway.winner_count));

    await pool.query(
        `UPDATE giveaways SET status = 'ended', winners = $1 WHERE message_id = $2`,
        [winners, giveaway.message_id]
    );

    giveaway.status = "ended";
    giveaway.winners = winners;

    await refreshGiveaway(giveaway, true);

    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);

    if (channel && channel.isTextBased() && winners.length) {
        const announcement = new ContainerBuilder()
            .setAccentColor(GREEN)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${BRAND} • WYNIKI\n## 🏆 Konkurs zakończony`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**🎁 Nagroda:** ${escapeText(giveaway.prize)}\n` +
                    `**👥 Uczestnicy:** ${ids.length}\n\n` +
                    `**🥇 Zwycięzcy:**\n` +
                    winners.map((id, index) => `${index + 1}. <@${id}>`).join("\n")
                )
            );

        await channel.send({
            components: [announcement],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { users: winners },
        }).catch(error => {
            console.error("[KONKURSY] Nie udało się wysłać ogłoszenia:", error.message);
        });
    } else if (channel && channel.isTextBased() && !winners.length) {
        await channel.send({
            content: `🏁 Konkurs **${escapeText(giveaway.prize)}** został zakończony, ale nikt nie wziął udziału :(`,
            allowedMentions: { parse: [] },
        }).catch(() => {});
    }

    return winners;
}

async function checkExpiredGiveaways() {
    if (checking) return;
    checking = true;

    try {
        const result = await pool.query(
            `SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= $1`,
            [Date.now()]
        );

        for (const giveaway of result.rows) {
            await drawWinners(giveaway);
        }
    } catch (error) {
        console.error("[KONKURSY] Błąd sprawdzania czasu:", error);
    } finally {
        checking = false;
    }
}

client.once("ready", async () => {
    try {
        await setupDatabase();

        const guild = client.guilds.cache.first();
        if (!guild) throw new Error("Bot nie jest na żadnym serwerze Discord.");

        const existing = await guild.commands.fetch();

        for (const command of commands) {
            const old = existing.find(c => c.name === command.name);
            if (old) await old.edit(command);
            else await guild.commands.create(command);
        }

        console.log(`[KONKURSY] Zarejestrowano komendy na serwerze: ${guild.name}`);

        initialized = true;
        console.log("[KONKURSY] Baza połączona, system uruchomiony.");

        await checkExpiredGiveaways();

        if (!intervalStarted) {
            intervalStarted = true;
            setInterval(checkExpiredGiveaways, 15_000);
        }
    } catch (error) {
        console.error("[KONKURSY] Błąd uruchamiania:", error);
    }
});

client.on("interactionCreate", async interaction => {
    try {
        if (!initialized) {
            if (
                interaction.isChatInputCommand() ||
                interaction.isButton()
            ) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "System konkursów jeszcze się uruchamia. Spróbuj za chwilę.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
            return;
        }

        // Przycisk konkursu — dołączanie lub wychodzenie.
        if (
            interaction.isButton() &&
            interaction.customId.startsWith(`${JOIN_ID}:`)
        ) {
            const id = interaction.customId.slice(JOIN_ID.length + 1);
            const result = await pool.query(
                "SELECT * FROM giveaways WHERE message_id = $1",
                [id]
            );
            const giveaway = result.rows[0];

            if (
                !giveaway ||
                giveaway.status !== "active" ||
                Number(giveaway.ends_at) <= Date.now()
            ) {
                return interaction.reply({
                    content: "Ten konkurs jest już zakończony.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            const existingEntry = await pool.query(
                `SELECT user_id FROM giveaway_entries
                 WHERE giveaway_id = $1 AND user_id = $2`,
                [id, interaction.user.id]
            );

            if (existingEntry.rowCount > 0) {
                await pool.query(
                    `DELETE FROM giveaway_entries
                     WHERE giveaway_id = $1 AND user_id = $2`,
                    [id, interaction.user.id]
                );

                await interaction.reply({
                    content: `↩️ Wyszedłeś z konkursu **${escapeText(giveaway.prize)}**. Możesz dołączyć ponownie, klikając przycisk.`,
                    flags: MessageFlags.Ephemeral,
                });

                await refreshGiveaway(giveaway);
                return;
            }

            await pool.query(
                `INSERT INTO giveaway_entries (giveaway_id, user_id, joined_at)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (giveaway_id, user_id) DO NOTHING`,
                [id, interaction.user.id, Date.now()]
            );

            await interaction.reply({
                content: `✅ Dołączono do konkursu **${escapeText(giveaway.prize)}**! Powodzenia!`,
                flags: MessageFlags.Ephemeral,
            });

            await refreshGiveaway(giveaway);
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        // Tworzenie konkursu.
        if (commandName === "konkurs") {
            if (!interaction.inGuild() || !interaction.channel?.isTextBased()) {
                return interaction.reply({
                    content: "Tej komendy można używać tylko na serwerze.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!hasGiveawayPermission(interaction)) {
                return interaction.reply({
                    content: "❌ Nie masz uprawnień do tworzenia konkursów. Wymagana rola: <@&1495094192957817025> lub <@&1540162111706103848>.",
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] },
                });
            }

            const prize = interaction.options.getString("nagroda", true).trim();
            const dateInput = interaction.options.getString("data", true).trim();
            const timeInput = interaction.options.getString("godzina", true).trim();
            const winnerCount = interaction.options.getInteger("zwyciezcy", true);
            const endsAt = parseWarsawDateTime(dateInput, timeInput);

            if (!endsAt || endsAt <= Date.now()) {
                return interaction.reply({
                    content: "❌ Podaj prawidłową datę i godzinę w przyszłości. Data: `RRRR-MM-DD`, godzina: `GG:MM` (czas polski).",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!prize || prize.length > 200) {
                return interaction.reply({
                    content: "Nagroda musi mieć od 1 do 200 znaków.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const draft = {
                message_id: "pending",
                guild_id: interaction.guildId,
                channel_id: interaction.channelId,
                host_id: interaction.user.id,
                prize,
                winner_count: winnerCount,
                ends_at: endsAt,
                status: "active",
                winners: [],
            };

            const message = await interaction.channel.send({
                components: buildCard(draft, 0, false),
                flags: MessageFlags.IsComponentsV2,
            });

            draft.message_id = message.id;

            await pool.query(
                `INSERT INTO giveaways
                    (message_id, guild_id, channel_id, host_id, prize,
                     winner_count, ends_at, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
                [
                    message.id,
                    interaction.guildId,
                    interaction.channelId,
                    interaction.user.id,
                    prize,
                    winnerCount,
                    endsAt,
                    Date.now(),
                ]
            );

            await refreshGiveaway(draft);

            await interaction.editReply({
                content: `✅ Konkurs został utworzony!\n**Nagroda:** ${escapeText(prize)}\n**Koniec:** ${timestamp(endsAt)}\n**ID wiadomości:** \`${message.id}\``,
            });
            return;
        }
            // Ręczne zakończenie lub ponowne losowanie.
            if (
                commandName === "konkurs-zakoncz" ||
                commandName === "konkurs-losuj"
            ) {
                if (
                    !interaction.memberPermissions?.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content: "Potrzebujesz uprawnienia **Zarządzanie serwerem**.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const id = interaction.options
                    .getString("wiadomosc_id", true)
                    .trim();

                const result = await pool.query(
                    `SELECT *
                     FROM giveaways
                     WHERE message_id = $1 AND guild_id = $2`,
                    [id, interaction.guildId]
                );

                const giveaway = result.rows[0];

                if (!giveaway) {
                    return interaction.reply({
                        content: "Nie znaleziono konkursu o takim ID na tym serwerze.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                if (
                    commandName === "konkurs-zakoncz" &&
                    giveaway.status !== "active"
                ) {
                    return interaction.reply({
                        content:
                            "Ten konkurs jest już zakończony. Użyj `/konkurs-losuj`, aby wylosować ponownie.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const winners = await drawWinners(giveaway);

                await interaction.editReply({
                    content: winners.length
                        ? (
                            commandName === "konkurs-losuj"
                                ? `🔄 Wylosowano ponownie: ${winners.map(id => `<@${id}>`).join(", ")}`
                                : `🏆 Konkurs zakończony! Zwycięzcy: ${winners.map(id => `<@${id}>`).join(", ")}`
                        )
                        : "Konkurs zakończony, ale nie było uczestników.",
                    allowedMentions: { users: winners },
                });

                return;
            }

            // Informacje o konkursie.
            if (commandName === "konkurs-info") {
                const id = interaction.options
                    .getString("wiadomosc_id", true)
                    .trim();

                const result = await pool.query(
                    `SELECT *
                     FROM giveaways
                     WHERE message_id = $1 AND guild_id = $2`,
                    [id, interaction.guildId]
                );

                const giveaway = result.rows[0];

                if (!giveaway) {
                    return interaction.reply({
                        content: "Nie znaleziono konkursu o takim ID na tym serwerze.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const count = await getEntryCount(id);
                const isEnded = giveaway.status !== "active";

                return interaction.reply({
                    content:
                        `**🎁 Nagroda:** ${escapeText(giveaway.prize)}\n` +
                        `**📌 Status:** ${isEnded ? "Zakończony" : "Aktywny"}\n` +
                        `**👥 Uczestnicy:** ${count}\n` +
                        `**🏆 Liczba zwycięzców:** ${giveaway.winner_count}\n` +
                        `**👤 Organizator:** <@${giveaway.host_id}>\n` +
                        `**🕒 Koniec:** ${timestamp(Number(giveaway.ends_at))}\n` +
                        `**🆔 ID wiadomości:** \`${giveaway.message_id}\``,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Komendy moderacyjne.
            // Wymagana jest rola perms.all.
            // Bot nie kickuje ani nie banuje graczy.
            const moderationCommands = [
                "czlonkowie",
                "sprawdz-gracza",
                "multikonto",
                "historia-moderacji",
                "usun-z-konkursu",
            ];

            if (moderationCommands.includes(commandName)) {
                if (!interaction.inGuild()) {
                    return interaction.reply({
                        content: "Tej komendy można używać tylko na serwerze.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                if (!hasRole(interaction, ROLE_MOD)) {
                    return interaction.reply({
                        content:
                            "❌ Nie masz uprawnień. Wymagana jest rola <@&1495094192957817025>.",
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                }

                // Lista członków serwera.
                if (commandName === "czlonkowie") {
                    await interaction.deferReply({
                        flags: MessageFlags.Ephemeral,
                    });

                    const search = (
                        interaction.options.getString("szukaj") || ""
                    ).toLowerCase().trim();

                    const members = await interaction.guild.members.fetch();

                    let found = [...members.values()];

                    if (search) {
                        found = found.filter(m =>
                            m.id.includes(search) ||
                            m.user.username.toLowerCase().includes(search) ||
                            (m.nickname || "").toLowerCase().includes(search) ||
                            m.user.tag.toLowerCase().includes(search)
                        );
                    }

                    found = found.slice(0, 10);

                    return interaction.editReply({
                        content: found.length
                            ? `**Wyniki (${found.length}, maks. 10):**\n` +
                              found.map(m =>
                                  `• ${m} — \`${m.user.tag}\` | ID: \`${m.id}\` | dołączył: ${
                                      m.joinedTimestamp
                                          ? safeDate(m.joinedTimestamp)
                                          : "brak danych"
                                  }`
                              ).join("\n")
                            : "Nie znaleziono członków.",
                        allowedMentions: { parse: [] },
                    });
                }

                // Sprawdzanie informacji o graczu.
                if (commandName === "sprawdz-gracza") {
                    const user = interaction.options.getUser("gracz", true);

                    const member = await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                    const rows = await getModerationRows(
                        interaction.guildId,
                        user.id,
                        5
                    );

                    const multiCount = (
                        await pool.query(
                            `SELECT COUNT(*)::int AS count
                             FROM moderation_history
                             WHERE guild_id = $1
                               AND target_id = $2
                               AND action = 'MULTIKONTO'`,
                            [interaction.guildId, user.id]
                        )
                    ).rows[0].count;

                    return interaction.reply({
                        content:
                            `## Sprawdzenie gracza\n` +
                            `**Użytkownik:** ${user} (${escapeText(user.tag)})\n` +
                            `**ID:** \`${user.id}\`\n` +
                            `**Na serwerze:** ${member ? "tak" : "nie"}\n` +
                            `**Konto utworzone:** ${safeDate(user.createdTimestamp)}\n` +
                            `**Dołączył:** ${
                                member?.joinedTimestamp
                                    ? safeDate(member.joinedTimestamp)
                                    : "brak danych"
                            }\n` +
                            `**Podejrzenia multikonta:** ${multiCount}\n` +
                            `**Ostatnia historia:**\n${formatModerationRows(rows)}`,
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                }

                // Zapis podejrzenia multikonta.
                // To tylko wpis do historii — bez automatycznej kary.
                if (commandName === "multikonto") {
                    const user = interaction.options.getUser("gracz", true);
                    const reason = interaction.options
                        .getString("powod", true)
                        .trim();

                    await logModeration(
                        interaction,
                        user.id,
                        "MULTIKONTO",
                        reason
                    );

                    return interaction.reply({
                        content:
                            `⚠️ Zapisano podejrzenie multikonta dla ${user}. ` +
                            `To wyłącznie wpis do historii — bot nie nakłada żadnej kary.\n` +
                            `**Powód:** ${escapeText(reason)}`,
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { users: [user.id] },
                    });
                }

                // Historia moderacji wybranego gracza.
                if (commandName === "historia-moderacji") {
                    const user = interaction.options.getUser("gracz", true);

                    const rows = await getModerationRows(
                        interaction.guildId,
                        user.id,
                        12
                    );

                    return interaction.reply({
                        content:
                            `## Historia moderacji: ${escapeText(user.tag)}\n` +
                            formatModerationRows(rows),
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                }

                // Usunięcie gracza wyłącznie z konkretnego konkursu.
                if (commandName === "usun-z-konkursu") {
                    const messageId = interaction.options
                        .getString("wiadomosc_id", true)
                        .trim();

                    const user = interaction.options.getUser("gracz", true);

                    const reason = (
                        interaction.options.getString("powod") ||
                        "Nie podano powodu."
                    ).trim();

                    const result = await pool.query(
                        `SELECT *
                         FROM giveaways
                         WHERE message_id = $1
                           AND guild_id = $2`,
                        [messageId, interaction.guildId]
                    );

                    const giveaway = result.rows[0];

                    if (!giveaway) {
                        return interaction.reply({
                            content:
                                "Nie znaleziono konkursu o takim ID na tym serwerze.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    if (giveaway.status !== "active") {
                        return interaction.reply({
                            content:
                                "Nie można usuwać uczestników z zakończonego konkursu.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const deleted = await pool.query(
                        `DELETE FROM giveaway_entries
                         WHERE giveaway_id = $1
                           AND user_id = $2
                         RETURNING user_id`,
                        [messageId, user.id]
                    );

                    if (!deleted.rowCount) {
                        return interaction.reply({
                            content:
                                "Ten gracz nie bierze udziału w tym konkursie.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    await logModeration(
                        interaction,
                        user.id,
                        "USUNIĘCIE_Z_KONKURSU",
                        reason,
                        messageId
                    );

                    await refreshGiveaway(giveaway);

                    return interaction.reply({
                        content:
                            `✅ Usunięto ${user} wyłącznie z konkursu **${escapeText(giveaway.prize)}**.\n` +
                            `**Powód:** ${escapeText(reason)}\n` +
                            `Nie wyrzucono go z serwera, nie zbanowano i nie zmieniono mu ról.`,
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                }
            }
        } catch (error) {
            console.error("[KONKURSY] Błąd interakcji:", error);

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content: "Wystąpił błąd. Sprawdź logi bota na Renderze.",
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
            } else if (
                interaction.isRepliable() &&
                interaction.deferred &&
                !interaction.replied
            ) {
                await interaction.editReply({
                    content: "Wystąpił błąd. Sprawdź logi bota na Renderze.",
                }).catch(() => {});
            }
        }
    });
};
