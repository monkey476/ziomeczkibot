
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
    const BRAND = "LOWHUB.PL";
    const JOIN_ID = "konkurs_join";

    const ROLE_ALL = "1495094192957817025";
    const ROLE_GIVEAWAY = "1540162111706103848";

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
                o.setName("data")
                    .setDescription("Data zakończenia, np. 2026-11-05")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("godzina")
                    .setDescription("Godzina zakończenia, np. 18:30")
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

        new SlashCommandBuilder()
            .setName("czlonkowie")
            .setDescription("Pokaż uczestników konkursu")
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("ID wiadomości konkursowej")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("sprawdz-gracza")
            .setDescription("Sprawdź konto i udział gracza")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Gracz do sprawdzenia")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("Opcjonalne ID konkursu")
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("multikonto")
            .setDescription("Sprawdź podstawowe sygnały możliwego multikonta")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Gracz do sprawdzenia")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("historia-moderacji")
            .setDescription("Pokaż historię działań moderacyjnych")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Opcjonalnie filtruj po graczu")
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

        new SlashCommandBuilder()
            .setName("usun-z-konkursu")
            .setDescription("Usuń gracza z konkursu")
            .addStringOption(o =>
                o.setName("wiadomosc_id")
                    .setDescription("ID wiadomości konkursowej")
                    .setRequired(true)
            )
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Gracz do usunięcia")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS giveaway_moderation_log (
                id BIGSERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                target_id TEXT,
                action TEXT NOT NULL,
                details TEXT,
                created_at BIGINT NOT NULL
            )
        `);
    }

    function hasGiveawayPermission(interaction) {
        const roles = interaction.member?.roles;

        if (!roles) return false;

        if (roles.cache) {
            return roles.cache.has(ROLE_ALL) ||
                roles.cache.has(ROLE_GIVEAWAY);
        }

        if (Array.isArray(roles)) {
            return roles.includes(ROLE_ALL) ||
                roles.includes(ROLE_GIVEAWAY);
        }

        return false;
    }

    function parseWarsawDateTime(dateValue, timeValue) {
        const dateMatch = dateValue.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        const timeMatch = timeValue.match(
            /^([01]\d|2[0-3]):([0-5]\d)$/
        );

        if (!dateMatch || !timeMatch) return null;

        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        const hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);

        const desiredUTC = Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute
        );

        const checkDate = new Date(desiredUTC);

        if (
            checkDate.getUTCFullYear() !== year ||
            checkDate.getUTCMonth() !== month - 1 ||
            checkDate.getUTCDate() !== day
        ) {
            return null;
        }

        let result = desiredUTC;

        const formatter = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Warsaw",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });

        for (let i = 0; i < 4; i++) {
            const parts = Object.fromEntries(
                formatter.formatToParts(new Date(result))
                    .filter(p => p.type !== "literal")
                    .map(p => [p.type, Number(p.value)])
            );

            const actualUTC = Date.UTC(
                parts.year,
                parts.month - 1,
                parts.day,
                parts.hour,
                parts.minute
            );

            const difference = desiredUTC - actualUTC;

            if (difference === 0) break;

            result += difference;
        }

        const finalParts = Object.fromEntries(
            formatter.formatToParts(new Date(result))
                .filter(p => p.type !== "literal")
                .map(p => [p.type, Number(p.value)])
        );

        if (
            finalParts.year !== year ||
            finalParts.month !== month ||
            finalParts.day !== day ||
            finalParts.hour !== hour ||
            finalParts.minute !== minute ||
            result <= Date.now()
        ) {
            return null;
        }

        return result;
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

    async function logModeration(
        interaction,
        targetId,
        action,
        details = ""
    ) {
        await pool.query(
            `INSERT INTO giveaway_moderation_log
                (guild_id, moderator_id, target_id, action, details, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                interaction.guildId,
                interaction.user.id,
                targetId || null,
                action,
                details,
                Date.now(),
            ]
        );
    }

    function buildCard(giveaway, participantCount, ended = false) {
        const winners = Array.isArray(giveaway.winners)
            ? giveaway.winners
            : [];

        const container = new ContainerBuilder()
            .setAccentColor(GREEN)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${BRAND} • KONKURS`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**🎁 Nagroda:** ${escapeText(giveaway.prize)}\n` +
                    `👥 **Uczestnicy:** ${participantCount}\n` +
                    `🏆 **Zwycięzcy:** ${Number(giveaway.winner_count)}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    ended
                        ? `### 🏁 Konkurs zakończony\n${
                            winners.length
                                ? `**Wylosowani:** ${winners.map(id => `<@${id}>`).join(", ")}`
                                : "Brak uczestników, nie udało się wyłonić zwycięzcy."
                        }`
                        : `**🏁 Koniec:** <t:${Math.floor(Number(giveaway.ends_at) / 1000)}:F>\n` +
                          `**⌛ Pozostały czas:** ${timestamp(giveaway.ends_at)}`
                )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `${JOIN_ID}:${giveaway.message_id}`
                        )
                        .setLabel(
                            ended ? "Konkurs zakończony" : "Weź udział"
                        )
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

        if (!channel?.isTextBased() || !channel.messages) return;

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
                "[KONKURSY] Odświeżenie:",
                error.message
            );
        });
    }

    async function drawWinners(giveaway) {
        const result = await pool.query(
            `SELECT user_id
             FROM giveaway_entries
             WHERE giveaway_id = $1`,
            [giveaway.message_id]
        );

        const ids = result.rows.map(row => row.user_id);

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

        if (channel?.isTextBased()) {
            if (winners.length) {
                const post = new ContainerBuilder()
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
                            winners.map((id, i) => `${i + 1}. <@${id}>`).join("\n")
                        )
                    );

                await channel.send({
                    components: [post],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { users: winners },
                }).catch(() => {});
            } else {
                await channel.send({
                    content: `🏁 Konkurs **${escapeText(giveaway.prize)}** zakończony — nikt nie wziął udziału.`,
                    allowedMentions: { parse: [] },
                }).catch(() => {});
            }
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
            console.error(
                "[KONKURSY] Sprawdzanie czasu:",
                error
            );
        } finally {
            checking = false;
        }
    }

    client.once("ready", async () => {
        try {
            await setupDatabase();

            const guild = client.guilds.cache.first();

            if (!guild) {
                throw new Error(
                    "Bot nie jest na żadnym serwerze Discord."
                );
            }

            const existing = await guild.commands.fetch();

            for (const command of commands) {
                const old = existing.find(
                    c => c.name === command.name
                );

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

            console.log(
                "[KONKURSY] Baza połączona, system uruchomiony."
            );

            await checkExpiredGiveaways();

            if (!intervalStarted) {
                intervalStarted = true;
                setInterval(checkExpiredGiveaways, 15000);
            }
        } catch (error) {
            console.error(
                "[KONKURSY] Błąd uruchamiania:",
                error
            );
        }
    });

    client.on("interactionCreate", async interaction => {
        try {
            if (!initialized) {
                if (
                    (interaction.isChatInputCommand() || interaction.isButton()) &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {
                    await interaction.reply({
                        content: "System konkursów jeszcze się uruchamia. Spróbuj za chwilę.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return;
            }

            // Dołączanie i wychodzenie z konkursu.
            if (
                interaction.isButton() &&
                interaction.customId.startsWith(`${JOIN_ID}:`)
            ) {
                const id = interaction.customId.slice(
                    JOIN_ID.length + 1
                );

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

                const existing = await pool.query(
                    `SELECT user_id
                     FROM giveaway_entries
                     WHERE giveaway_id = $1 AND user_id = $2`,
                    [id, interaction.user.id]
                );

                if (existing.rowCount > 0) {
                    await pool.query(
                        `DELETE FROM giveaway_entries
                         WHERE giveaway_id = $1 AND user_id = $2`,
                        [id, interaction.user.id]
                    );

                    await interaction.reply({
                        content: `↩️ Wyszedłeś z konkursu **${escapeText(giveaway.prize)}**.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await pool.query(
                        `INSERT INTO giveaway_entries
                            (giveaway_id, user_id, joined_at)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (giveaway_id, user_id) DO NOTHING`,
                        [id, interaction.user.id, Date.now()]
                    );

                    await interaction.reply({
                        content: `✅ Dołączono do konkursu **${escapeText(giveaway.prize)}**! Powodzenia!`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await refreshGiveaway(giveaway);
                return;
            }

            if (!interaction.isChatInputCommand()) return;

            const { commandName } = interaction;

            // Tworzenie konkursu.
            if (commandName === "konkurs") {
                if (
                    !interaction.inGuild() ||
                    !interaction.channel?.isTextBased()
                ) {
                    return interaction.reply({
                        content: "Tej komendy można używać tylko na serwerze.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                if (!hasGiveawayPermission(interaction)) {
                    return interaction.reply({
                        content: `❌ Brak uprawnień. Wymagana rola <@&${ROLE_ALL}> lub <@&${ROLE_GIVEAWAY}>.`,
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                }

                const prize = interaction.options.getString("nagroda", true).trim();
                const date = interaction.options.getString("data", true).trim();
                const time = interaction.options.getString("godzina", true).trim();
                const winnerCount = interaction.options.getInteger("zwyciezcy", true);

                const endsAt = parseWarsawDateTime(date, time);

                if (!endsAt) {
                    return interaction.reply({
                        content: "❌ Nieprawidłowa data/godzina lub termin minął. Format: RRRR-MM-DD oraz GG:MM.",
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

                const msg = await interaction.channel.send({
                    components: buildCard(draft, 0),
                    flags: MessageFlags.IsComponentsV2,
                });

                draft.message_id = msg.id;

                await pool.query(
                    `INSERT INTO giveaways
                        (message_id, guild_id, channel_id, host_id, prize,
                         winner_count, ends_at, status, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
                    [
                        msg.id,
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
                    content: `✅ Konkurs utworzony!\n**Nagroda:** ${escapeText(prize)}\n**Koniec:** <t:${Math.floor(endsAt / 1000)}:F>\n**ID wiadomości:** \`${msg.id}\``,
                });

                return;
            }

            // Ręczne zakończenie lub ponowne losowanie.
            if (
                commandName === "konkurs-zakoncz" ||
                commandName === "konkurs-losuj"
            ) {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({
                        content: "Potrzebujesz uprawnienia **Zarządzanie serwerem**.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const id = interaction.options.getString("wiadomosc_id", true).trim();

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
                        content: "Konkurs już zakończono. Użyj /konkurs-losuj, aby wylosować ponownie.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const winners = await drawWinners(giveaway);

                await interaction.editReply({
                    content: winners.length
                        ? `${commandName === "konkurs-losuj" ? "🔄 Wylosowano ponownie" : "🏆 Konkurs zakończony"}: ${winners.map(id => `<@${id}>`).join(", ")}`
                        : "Konkurs zakończony, ale nie było uczestników.",
                    allowedMentions: { users: winners },
                });

                return;
            }

            // Informacje o konkursie.
            if (commandName === "konkurs-info") {
                const id = interaction.options.getString("wiadomosc_id", true).trim();

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

                return interaction.reply({
                    content:
                        `**🎁 Nagroda:** ${escapeText(giveaway.prize)}\n` +
                        `**📌 Status:** ${giveaway.status === "active" ? "Aktywny" : "Zakończony"}\n` +
                        `**👥 Uczestnicy:** ${await getEntryCount(id)}\n` +
                        `**🏆 Liczba zwycięzców:** ${giveaway.winner_count}\n` +
                        `**👤 Organizator:** <@${giveaway.host_id}>\n` +
                        `**🕒 Koniec:** <t:${Math.floor(Number(giveaway.ends_at) / 1000)}:F>\n` +
                        `**🆔 ID wiadomości:** \`${giveaway.message_id}\``,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Komendy moderacyjne — wymagają uprawnienia Zarządzanie serwerem.
            const moderationCommands = [
                "czlonkowie",
                "sprawdz-gracza",
                "multikonto",
                "historia-moderacji",
                "usun-z-konkursu",
            ];

            if (
                moderationCommands.includes(commandName) &&
                !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
            ) {
                return interaction.reply({
                    content: "Potrzebujesz uprawnienia **Zarządzanie serwerem**.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (commandName === "czlonkowie") {
                const id = interaction.options.getString("wiadomosc_id", true).trim();

                const result = await pool.query(
                    `SELECT e.user_id, e.joined_at
                     FROM giveaway_entries e
                     JOIN giveaways g ON g.message_id = e.giveaway_id
                     WHERE e.giveaway_id = $1 AND g.guild_id = $2
                     ORDER BY e.joined_at ASC
                     LIMIT 50`,
                    [id, interaction.guildId]
                );

                if (!result.rowCount) {
                    return interaction.reply({
                        content: "Nie znaleziono uczestników albo ID konkursu jest nieprawidłowe.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await logModeration(
                    interaction,
                    null,
                    "czlonkowie",
                    `Konkurs ${id}; liczba: ${result.rowCount}`
                );

                return interaction.reply({
                    content:
                        `**Uczestnicy konkursu** (\`${id}\`), pokazano maks. 50:\n` +
                        result.rows.map((row, index) =>
                            `${index + 1}. <@${row.user_id}> — <t:${Math.floor(Number(row.joined_at) / 1000)}:R>`
                        ).join("\n"),
                    allowedMentions: { parse: [] },
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (commandName === "sprawdz-gracza") {
                const user = interaction.options.getUser("gracz", true);
                const id = interaction.options.getString("wiadomosc_id");
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                let participation = "Nie sprawdzono konkursu.";

                if (id) {
                    const result = await pool.query(
                        `SELECT joined_at
                         FROM giveaway_entries
                         WHERE giveaway_id = $1 AND user_id = $2`,
                        [id, user.id]
                    );

                    participation = result.rowCount
                        ? `Uczestniczy w konkursie od <t:${Math.floor(Number(result.rows[0].joined_at) / 1000)}:R>.`
                        : "Nie uczestniczy w podanym konkursie.";
                }

                await logModeration(
                    interaction,
                    user.id,
                    "sprawdz-gracza",
                    id || "Bez ID konkursu"
                );

                return interaction.reply({
                    content:
                        `**Sprawdzenie gracza:** ${user}\n` +
                        `**ID:** \`${user.id}\`\n` +
                        `**Konto utworzono:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n` +
                        `**Na serwerze:** ${member ? `jest; dołączył <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "nie znaleziono na serwerze"}\n` +
                        `**Konkurs:** ${participation}`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (commandName === "multikonto") {
                const user = interaction.options.getUser("gracz", true);
                const ageDays = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                const joinedDays = member?.joinedTimestamp
                    ? Math.floor((Date.now() - member.joinedTimestamp) / 86400000)
                    : null;

                const signals = [];

                if (ageDays < 7) signals.push("konto ma mniej niż 7 dni");
                if (joinedDays !== null && joinedDays < 2) {
                    signals.push("dołączenie na serwer było mniej niż 2 dni temu");
                }

                await logModeration(
                    interaction,
                    user.id,
                    "multikonto-check",
                    signals.join("; ") || "Brak prostych sygnałów"
                );

                return interaction.reply({
                    content:
                        `**Wstępne sprawdzenie:** ${user}\n` +
                        `Wiek konta: **${ageDays} dni**.\n` +
                        `${joinedDays === null ? "Gracz nie jest obecnie na serwerze." : `Na serwerze: **${joinedDays} dni**.`}\n` +
                        `${signals.length ? `⚠️ Sygnały do ręcznego sprawdzenia: ${signals.join("; ")}.` : "Nie wykryto tych prostych sygnałów."}\n\n` +
                        "To nie potwierdza ani nie wyklucza multikonta — Discord nie udostępnia botowi pewnej informacji o innych kontach tej samej osoby.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (commandName === "historia-moderacji") {
                const user = interaction.options.getUser("gracz");

                const result = await pool.query(
                    `SELECT moderator_id, target_id, action, details, created_at
                     FROM giveaway_moderation_log
                     WHERE guild_id = $1 ${user ? "AND target_id = $2" : ""}
                     ORDER BY created_at DESC
                     LIMIT 10`,
                    user
                        ? [interaction.guildId, user.id]
                        : [interaction.guildId]
                );

                return interaction.reply({
                    content: result.rowCount
                        ? `**Ostatnie działania moderacyjne${user ? ` dla ${user}` : ""}:**\n` +
                          result.rows.map(row =>
                              `• <t:${Math.floor(Number(row.created_at) / 1000)}:R> — **${row.action}**; moderator <@${row.moderator_id}>; ${row.target_id ? `gracz <@${row.target_id}>; ` : ""}${escapeText(row.details || "brak szczegółów")}`
                          ).join("\n")
                        : "Brak zapisanych działań moderacyjnych.",
                    allowedMentions: { parse: [] },
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (commandName === "usun-z-konkursu") {
                const id = interaction.options.getString("wiadomosc_id", true).trim();
                const user = interaction.options.getUser("gracz", true);

                const giveaway = await pool.query(
                    `SELECT message_id, prize
                     FROM giveaways
                     WHERE message_id = $1 AND guild_id = $2`,
                    [id, interaction.guildId]
                );

                if (!giveaway.rowCount) {
                    return interaction.reply({
                        content: "Nie znaleziono konkursu o takim ID.",
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const removed = await pool.query(
                    `DELETE FROM giveaway_entries
                     WHERE giveaway_id = $1 AND user_id = $2`,
                    [id, user.id]
                );

                await logModeration(
                    interaction,
                    user.id,
                    "usun-z-konkursu",
                    `Konkurs ${id}; ${giveaway.rows[0].prize}`
                );

                const fullGiveaway = await pool.query(
                    "SELECT * FROM giveaways WHERE message_id = $1",
                    [id]
                );

                if (fullGiveaway.rowCount) {
                    await refreshGiveaway(
                        fullGiveaway.rows[0],
                        fullGiveaway.rows[0].status !== "active"
                    );
                }

                return interaction.reply({
                    content: removed.rowCount
                        ? `Usunięto ${user} z konkursu **${escapeText(giveaway.rows[0].prize)}**.`
                        : "Ten gracz nie brał udziału w podanym konkursie.",
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
