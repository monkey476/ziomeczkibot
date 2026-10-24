
const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

const { Pool } = require("pg");

module.exports = (client) => {
    if (!process.env.DATABASE_URL) {
        console.error("[KONKURSY] Brak zmiennej DATABASE_URL w Renderze.");
        return;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const GREEN = 0x65E65B;
    const GOLD = 0xF5C451;
    const BRAND = "LOWHUB.PL";
    const JOIN_ID = "konkurs_join";

    const commands = [
        new SlashCommandBuilder()
            .setName("konkurs")
            .setDescription("Utwórz nowy konkurs")
            .addStringOption(o =>
                o.setName("nagroda")
                    .setDescription("Co można wygrać?")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("czas")
                    .setDescription("Czas, np. 30m, 2h, 1d")
                    .setRequired(true)
            )
            .addIntegerOption(o =>
                o.setName("zwyciezcy")
                    .setDescription("Liczba zwycięzców")
                    .setMinValue(1)
                    .setMaxValue(20)
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName("konkurs-zakoncz")
            .setDescription("Zakończ konkurs wcześniej")
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("ID wiadomości konkursowej")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("konkurs-losuj")
            .setDescription("Wylosuj ponownie zwycięzców")
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("ID wiadomości konkursowej")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("konkurs-info")
            .setDescription("Sprawdź informacje o konkursie")
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("ID wiadomości konkursowej")
                    .setRequired(true)
            ),
    ].map(command => command.toJSON());

    let initialized = false;
    let checking = false;
    let intervalStarted = false;

    async function setupDatabase() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS giveaways (
                message_id TEXT PRIMARY KEY,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                host_id TEXT NOT NULL,
                prize TEXT NOT NULL,
                winner_count INTEGER NOT NULL,
                ends_at BIGINT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                winners TEXT[] NOT NULL DEFAULT '{}',
                created_at BIGINT NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS giveaway_entries (
                giveaway_id TEXT NOT NULL
                    REFERENCES giveaways(message_id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                joined_at BIGINT NOT NULL,
                PRIMARY KEY (giveaway_id, user_id)
            )
        `);
    }

    function parseDuration(value) {
        const match = value.trim().match(/^(\d+)\s*(m|h|d)$/i);
        if (!match) return null;

        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();

        if (!Number.isSafeInteger(amount) || amount < 1) return null;

        const multiplier = {
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000,
        }[unit];

        const duration = amount * multiplier;

        if (
            !Number.isSafeInteger(duration) ||
            duration > 30 * 86_400_000
        ) {
            return null;
        }

        return duration;
    }

    function timestamp(ms) {
        return `<t:${Math.floor(Number(ms) / 1000)}:R>`;
    }

    function escapeText(value) {
        return String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/\*/g, "\\*")
            .replace(/_/g, "\\_")
            .replace(/`/g, "\\`")
            .replace(/~/g, "\\~")
            .replace(/\|/g, "\\|");
    }

    async function getEntryCount(id) {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM giveaway_entries
             WHERE giveaway_id = $1`,
            [id]
        );

        return result.rows[0].count;
    }

    function buildCard(giveaway, participantCount, ended = false) {
        const endsAt = Number(giveaway.ends_at);
        const prize = escapeText(giveaway.prize);
        const winnerCount = Number(giveaway.winner_count);
        const hostId = giveaway.host_id;
        const winners = Array.isArray(giveaway.winners)
            ? giveaway.winners
            : [];

        const container = new ContainerBuilder()
            .setAccentColor(ended ? GOLD : GREEN)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🎉 ${BRAND}\n` +
                    `### ✨ KONKURS COMMUNITY\n` +
                    `Weź udział i zgarnij wyjątkową nagrodę!`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 🎁 NAGRODA\n` +
                    `> **${prize}**\n\n` +
                    `**🏆 Liczba zwycięzców:** ${winnerCount}\n` +
                    `**👥 Uczestnicy:** ${participantCount}\n` +
                    `**👤 Organizator:** <@${hostId}>`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    ended
                        ? (
                            `## 🏁 KONKURS ZAKOŃCZONY\n` +
                            `Losowanie zostało zakończone.\n\n` +
                            `### 🥇 Wylosowani zwycięzcy\n` +
                            (
                                winners.length
                                    ? winners.map(id => `• <@${id}>`).join("\n")
                                    : "Brak uczestników — nie udało się wyłonić zwycięzcy."
                            )
                        )
                        : (
                            `## ⏳ KONKURS TRWA!\n` +
                            `**Koniec konkursu:** <t:${Math.floor(endsAt / 1000)}:F>\n` +
                            `**Pozostały czas:** ${timestamp(endsAt)}\n\n` +
                            `Kliknij przycisk poniżej, aby dołączyć.\n` +
                            `Powodzenia! 🍀`
                        )
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${JOIN_ID}:${giveaway.message_id}`)
                        .setLabel(ended ? "Konkurs zakończony" : "Weź udział")
                        .setEmoji(ended ? "🏁" : "🎉")
                        .setStyle(
                            ended
                                ? ButtonStyle.Secondary
                                : ButtonStyle.Success
                        )
                        .setDisabled(ended)
                )
            );

        return [container];
    }

    async function refreshGiveaway(giveaway, ended = false) {
        const channel = await client.channels
            .fetch(giveaway.channel_id)
            .catch(() => null);

        if (!channel || !channel.isTextBased() || !channel.messages) return;

        const message = await channel.messages
            .fetch(giveaway.message_id)
            .catch(() => null);

        if (!message) return;

        const count = await getEntryCount(giveaway.message_id);

        await message.edit({
            components: buildCard(giveaway, count, ended),
            flags: MessageFlags.IsComponentsV2,
        }).catch(error => {
            console.error(
                "[KONKURSY] Nie udało się odświeżyć wiadomości:",
                error.message
            );
        });
    }

    async function drawWinners(giveaway) {
        const entries = await pool.query(
            `SELECT user_id
             FROM giveaway_entries
             WHERE giveaway_id = $1`,
            [giveaway.message_id]
        );

        const ids = entries.rows.map(row => row.user_id);

        // Losowanie bez powtarzania tej samej osoby.
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }

        const winners = ids.slice(
            0,
            Number(giveaway.winner_count)
        );

        await pool.query(
            `UPDATE giveaways
             SET status = 'ended', winners = $1
             WHERE message_id = $2`,
            [winners, giveaway.message_id]
        );

        giveaway.status = "ended";
        giveaway.winners = winners;

        await refreshGiveaway(giveaway, true);

        const channel = await client.channels
            .fetch(giveaway.channel_id)
            .catch(() => null);

        if (channel && channel.isTextBased() && winners.length) {
            const announcement = new ContainerBuilder()
                .setAccentColor(GOLD)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# 🏆 ${BRAND}\n` +
                        `### KONKURS ZAKOŃCZONY!\n` +
                        `Dziękujemy wszystkim za udział!`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## 🎁 Nagroda\n` +
                        `> **${escapeText(giveaway.prize)}**\n\n` +
                        `### 🥇 Zwycięzcy\n` +
                        winners.map((id, index) => `${index + 1}. <@${id}>`).join("\n") +
                        `\n\n**👥 Liczba uczestników:** ${ids.length}`
                    )
                );

            await channel.send({
                components: [announcement],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { users: winners },
            }).catch(error => {
                console.error(
                    "[KONKURSY] Nie udało się wysłać ogłoszenia:",
                    error.message
                );
            });
        } else if (channel && channel.isTextBased() && !winners.length) {
            await channel.send({
                content: `🏁 Konkurs **${escapeText(giveaway.prize)}** został zakończony, ale nikt nie wziął udziału.`,
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
                `SELECT *
                 FROM giveaways
                 WHERE status = 'active' AND ends_at <= $1`,
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

            // Rejestracja komend na pierwszym serwerze bota.
            const guild = client.guilds.cache.first();

            if (!guild) {
                throw new Error("Bot nie jest na żadnym serwerze Discord.");
            }

            const existing = await guild.commands.fetch();

            for (const command of commands) {
                const old = existing.find(c => c.name === command.name);

                if (old) {
                    await old.edit(command);
                } else {
                    await guild.commands.create(command);
                }
            }

            console.log(
                `[KONKURSY] Zarejestrowano komendy na serwerze: ${guild.name}`
            );

            initialized = true;

            console.log("[KONKURSY] Baza połączona, system uruchomiony.");

            // Obsługa konkursów, których termin minął podczas restartu.
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

            // Dołączanie do konkursu przyciskiem.
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

                const inserted = await pool.query(
                    `INSERT INTO giveaway_entries
                        (giveaway_id, user_id, joined_at)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (giveaway_id, user_id) DO NOTHING
                     RETURNING user_id`,
                    [id, interaction.user.id, Date.now()]
                );

                if (!inserted.rowCount) {
                    return interaction.reply({
                        content: "Już bierzesz udział w tym konkursie!",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.reply({
                    content:
                        `🎉 Dołączono do konkursu **${escapeText(giveaway.prize)}**!\n` +
                        `Powodzenia! 🍀`,
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

                const prize = interaction.options
                    .getString("nagroda", true)
                    .trim();

                const durationInput = interaction.options
                    .getString("czas", true);

                const winnerCount = interaction.options
                    .getInteger("zwyciezcy", true);

                const duration = parseDuration(durationInput);

                if (!duration) {
                    return interaction.reply({
                        content:
                            "Nieprawidłowy czas. Użyj `30m`, `2h` albo `1d` " +
                            "(maksymalnie 30 dni).",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                if (!prize || prize.length > 200) {
                    return interaction.reply({
                        content: "Nagroda musi mieć od 1 do 200 znaków.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const endsAt = Date.now() + duration;

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
                    content:
                        `✅ Konkurs został utworzony!\n` +
                        `**Nagroda:** ${escapeText(prize)}\n` +
                        `**Koniec:** ${timestamp(endsAt)}\n` +
                        `**ID wiadomości:** \`${message.id}\``,
                });

                return;
            }

            // Ręczne zakończenie konkursu lub ponowne losowanie.
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

                if (commandName === "konkurs-zakoncz") {
                    if (giveaway.status !== "active") {
                        return interaction.reply({
                            content:
                                "Ten konkurs jest już zakończony. " +
                                "Użyj `/konkurs-losuj`, aby wylosować ponownie.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
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
