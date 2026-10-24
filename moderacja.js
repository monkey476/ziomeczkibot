
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
    MessageFlags,
} = require("discord.js");

module.exports = (client) => {
    const BRAND = "LOWHUB.PL";
    const GREEN = 0x65E65B;
    const RED = 0xED4245;
    const YELLOW = 0xFEE75C;
    const BLUE = 0x3498DB;

    const role = {
        warn: "1540162521678221362",
        tempmute: "1540162523884683384",
        kick: "1540165382348869682",
        tempban: "1540165382734749746",
        ban: "1540165383372144700",
        all: "1495094192957817025",
    };

    const kanalOdwolanID = "1542546740719124561";

    const komendy = [
        new SlashCommandBuilder()
            .setName("warn")
            .setDescription("Nadaj użytkownikowi ostrzeżenie")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Użytkownik")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("powod")
                    .setDescription("Powód ostrzeżenia")
                    .setMaxLength(500)
            ),

        new SlashCommandBuilder()
            .setName("kick")
            .setDescription("Wyrzuć użytkownika z serwera")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Użytkownik")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("powod")
                    .setDescription("Powód wyrzucenia")
                    .setMaxLength(500)
            ),

        new SlashCommandBuilder()
            .setName("ban")
            .setDescription("Zbanuj użytkownika na serwerze")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Użytkownik")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("powod")
                    .setDescription("Powód bana")
                    .setMaxLength(500)
            ),

        new SlashCommandBuilder()
            .setName("tempmute")
            .setDescription("Wycisz użytkownika na określony czas")
            .addUserOption(o =>
                o.setName("gracz")
                    .setDescription("Użytkownik")
                    .setRequired(true)
            )
            .addIntegerOption(o =>
                o.setName("czas")
                    .setDescription("Czas wyciszenia w minutach")
                    .setMinValue(1)
                    .setMaxValue(40320)
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("powod")
                    .setDescription("Powód wyciszenia")
                    .setMaxLength(500)
            ),
    ].map(c => c.toJSON());

    const wymaganeRole = {
        warn: role.warn,
        kick: role.kick,
        ban: role.ban,
        tempmute: role.tempmute,
    };

    function maUprawnienia(member, wymaganaRola) {
        if (!member) return false;

        return (
            member.permissions?.has(PermissionFlagsBits.Administrator) ||
            member.roles?.cache?.has(role.all) ||
            member.roles?.cache?.has(wymaganaRola)
        );
    }

    function embed(title, description, color = GREEN) {
        return new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: `${BRAND} • MODERACJA`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: BRAND })
            .setTimestamp();
    }

    async function odpowiedz(interaction, content, ephemeral = true) {
        const payload = {
            content,
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        };

        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(payload).catch(() => {});
        }

        return interaction.reply(payload).catch(() => {});
    }

    // Rejestruj tylko własne komendy. Nie usuwaj komend innych modułów.
    client.once("ready", async () => {
        try {
            for (const guild of client.guilds.cache.values()) {
                const existing = await guild.commands.fetch();

                for (const data of komendy) {
                    const old = existing.find(c => c.name === data.name);

                    if (old) {
                        await old.edit(data);
                    } else {
                        await guild.commands.create(data);
                    }
                }
            }

            console.log("[MODERACJA] Komendy LOWHUB.PL zarejestrowane.");
        } catch (error) {
            console.error("[MODERACJA] Błąd rejestracji komend:", error);
        }
    });

    client.on("interactionCreate", async interaction => {
        try {
            // Formularz odwołania nie jest komendą slash.
            if (
                interaction.isModalSubmit() &&
                interaction.customId === "modal_odwolanie_ban"
            ) {
                const tekst = interaction.fields
                    .getTextInputValue("powod_odwolania")
                    .trim();

                const kanal = await client.channels
                    .fetch(kanalOdwolanID)
                    .catch(() => null);

                if (!kanal || !kanal.isTextBased()) {
                    return odpowiedz(
                        interaction,
                        "Nie udało się wysłać odwołania. Skontaktuj się z administracją."
                    );
                }

                const odwolanie = new EmbedBuilder()
                    .setColor(BLUE)
                    .setAuthor({
                        name: `${BRAND} • ODWOŁANIA`,
                        iconURL: client.user.displayAvatarURL(),
                    })
                    .setTitle("Nowe odwołanie od bana")
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        {
                            name: "Użytkownik",
                            value: `${interaction.user.tag}\nID: ${interaction.user.id}`,
                            inline: true,
                        },
                        {
                            name: "Treść odwołania",
                            value: tekst.slice(0, 1024),
                            inline: false,
                        }
                    )
                    .setFooter({ text: BRAND })
                    .setTimestamp();

                await kanal.send({ embeds: [odwolanie] });

                return odpowiedz(
                    interaction,
                    "✅ Twoje odwołanie zostało wysłane do administracji."
                );
            }

            // Przycisk działa również w prywatnej wiadomości.
            if (
                interaction.isButton() &&
                interaction.customId === "przycisk_odwolanie_ban"
            ) {
                const formularz = new ModalBuilder()
                    .setCustomId("modal_odwolanie_ban")
                    .setTitle("Odwołanie od bana");

                const pole = new TextInputBuilder()
                    .setCustomId("powod_odwolania")
                    .setLabel("Dlaczego mamy Cię odbanować?")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Opisz swoją sytuację...")
                    .setMinLength(10)
                    .setMaxLength(1000)
                    .setRequired(true);

                formularz.addComponents(
                    new ActionRowBuilder().addComponents(pole)
                );

                return await interaction.showModal(formularz);
            }

            // KLUCZOWA POPRAWKA:
            // Ignoruj przyciski i komendy należące do innych modułów.
            if (!interaction.isChatInputCommand()) return;

            const commandName = interaction.commandName;

            // Moderacja obsługuje tylko te cztery komendy.
            if (!Object.hasOwn(wymaganeRole, commandName)) return;

            if (!interaction.inGuild() || !interaction.guild) {
                return odpowiedz(
                    interaction,
                    "Ta komenda działa tylko na serwerze."
                );
            }

            const member = interaction.member;

            if (!maUprawnienia(member, wymaganeRole[commandName])) {
                return odpowiedz(
                    interaction,
                    "❌ Nie masz uprawnień do użycia tej komendy."
                );
            }

            const targetUser = interaction.options.getUser("gracz");

            // Dodatkowe zabezpieczenie przed brakiem opcji gracza.
            if (!targetUser) {
                return odpowiedz(
                    interaction,
                    "Nie udało się odczytać wybranego użytkownika."
                );
            }

            if (targetUser.id === interaction.user.id) {
                return odpowiedz(
                    interaction,
                    "Nie możesz użyć tej komendy na sobie."
                );
            }

            if (targetUser.id === client.user.id) {
                return odpowiedz(
                    interaction,
                    "Nie możesz użyć tej komendy na bocie."
                );
            }

            const powod =
                interaction.options.getString("powod")?.trim() ||
                "Nie podano powodu";

            const targetMember = await interaction.guild.members
                .fetch(targetUser.id)
                .catch(() => null);

            if (!targetMember) {
                return odpowiedz(
                    interaction,
                    "Nie znaleziono tego użytkownika na serwerze."
                );
            }

            if (
                interaction.guild.ownerId !== interaction.user.id &&
                targetMember.roles.highest.position >=
                    interaction.member.roles.highest.position
            ) {
                return odpowiedz(
                    interaction,
                    "Nie możesz moderować użytkownika z równą lub wyższą rolą."
                );
            }

            if (
                targetMember.roles.highest.position >=
                interaction.guild.members.me.roles.highest.position
            ) {
                return odpowiedz(
                    interaction,
                    "Moja rola musi znajdować się wyżej niż rola tego użytkownika."
                );
            }

            // WARN
            if (commandName === "warn") {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const dm = embed(
                    "Otrzymałeś ostrzeżenie",
                    `Na serwerze **${BRAND}** otrzymałeś ostrzeżenie.\n\n` +
                    `**Administrator:** ${interaction.user.tag}\n` +
                    `**Powód:** ${powod}`,
                    YELLOW
                );

                await targetUser.send({ embeds: [dm] }).catch(() => {});

                return interaction.editReply({
                    embeds: [
                        embed(
                            "Ostrzeżenie nadane",
                            `**Użytkownik:** ${targetUser.tag}\n` +
                            `**Powód:** ${powod}`,
                            YELLOW
                        ),
                    ],
                });
            }

            // KICK
            if (commandName === "kick") {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const dm = embed(
                    "Zostałeś wyrzucony",
                    `Zostałeś wyrzucony z serwera **${BRAND}**.\n\n` +
                    `**Administrator:** ${interaction.user.tag}\n` +
                    `**Powód:** ${powod}`,
                    RED
                );

                await targetUser.send({ embeds: [dm] }).catch(() => {});

                try {
                    await targetMember.kick(
                        `Administrator: ${interaction.user.tag} | Powód: ${powod}`
                    );
                } catch (error) {
                    console.error("[MODERACJA] Kick:", error);

                    return interaction.editReply({
                        embeds: [
                            embed(
                                "Nie udało się wyrzucić użytkownika",
                                "Sprawdź uprawnienia bota i hierarchię ról.",
                                RED
                            ),
                        ],
                    });
                }

                return interaction.editReply({
                    embeds: [
                        embed(
                            "Użytkownik wyrzucony",
                            `**Użytkownik:** ${targetUser.tag}\n` +
                            `**Powód:** ${powod}`
                        ),
                    ],
                });
            }

            // BAN
            if (commandName === "ban") {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                const dm = embed(
                    `Ban na ${BRAND}`,
                    `Zostałeś zbanowany na serwerze **${BRAND}**.\n\n` +
                    `**Administrator:** ${interaction.user.tag}\n` +
                    `**Powód:** ${powod}\n\n` +
                    "Jeśli uważasz, że to pomyłka, możesz złożyć odwołanie.",
                    RED
                );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("przycisk_odwolanie_ban")
                        .setLabel("Odwołaj się od bana")
                        .setStyle(ButtonStyle.Secondary)
                );

                await targetUser
                    .send({ embeds: [dm], components: [row] })
                    .catch(() => {});

                try {
                    await targetMember.ban({
                        reason: `Administrator: ${interaction.user.tag} | Powód: ${powod}`,
                    });
                } catch (error) {
                    console.error("[MODERACJA] Ban:", error);

                    return interaction.editReply({
                        embeds: [
                            embed(
                                "Nie udało się zbanować użytkownika",
                                "Sprawdź uprawnienia bota i hierarchię ról.",
                                RED
                            ),
                        ],
                    });
                }

                return interaction.editReply({
                    embeds: [
                        embed(
                            "Użytkownik zbanowany",
                            `**Użytkownik:** ${targetUser.tag}\n` +
                            `**Powód:** ${powod}`
                        ),
                    ],
                });
            }

            // TEMPMUTE
            if (commandName === "tempmute") {
                const czasMinuty = interaction.options.getInteger("czas");

                if (!czasMinuty || czasMinuty < 1 || czasMinuty > 40320) {
                    return odpowiedz(
                        interaction,
                        "Podaj czas od 1 do 40320 minut (maksymalnie 28 dni)."
                    );
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral,
                });

                try {
                    await targetMember.timeout(
                        czasMinuty * 60_000,
                        `Administrator: ${interaction.user.tag} | Powód: ${powod}`
                    );
                } catch (error) {
                    console.error("[MODERACJA] Timeout:", error);

                    return interaction.editReply({
                        embeds: [
                            embed(
                                "Nie udało się wyciszyć użytkownika",
                                "Sprawdź uprawnienia bota i hierarchię ról.",
                                RED
                            ),
                        ],
                    });
                }

                const dm = embed(
                    "Otrzymałeś wyciszenie",
                    `Na serwerze **${BRAND}** zostałeś tymczasowo wyciszony.\n\n` +
                    `**Czas:** ${czasMinuty} min\n` +
                    `**Administrator:** ${interaction.user.tag}\n` +
                    `**Powód:** ${powod}`,
                    YELLOW
                );

                await targetUser.send({ embeds: [dm] }).catch(() => {});

                return interaction.editReply({
                    embeds: [
                        embed(
                            "Użytkownik wyciszony",
                            `**Użytkownik:** ${targetUser.tag}\n` +
                            `**Czas:** ${czasMinuty} min\n` +
                            `**Powód:** ${powod}`
                        ),
                    ],
                });
            }
        } catch (error) {
            console.error("[MODERACJA] Błąd interakcji:", error);

            if (interaction.isRepliable()) {
                await odpowiedz(
                    interaction,
                    "Wystąpił błąd podczas obsługi tej akcji. Sprawdź logi bota."
                );
            }
        }
    });
};
