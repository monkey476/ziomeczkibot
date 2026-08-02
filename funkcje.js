const { EmbedBuilder } = require('discord.js');

// --- KONFIGURACJA KANAŁU 4FUN ---
const CHANNEL_ID = '1533292902271291432'; // ❓・zgadnij-słowo

// Baza unikalnych zagadek i słów (każda jest inna, żadna się nie powtórzy)
const zagadki = [
    {
        zagadka: "Mam klucze, ale nie otwieram żadnych drzwi. Mam przestrzenie, ale nie mam pokoi. Możesz wejść, ale nie możesz wyjść na zewnątrz. Co to takiego?",
        odpowiedz: "klawiatura",
        wskazówka: "Używasz tego urządzenia każdego dnia do pisania."
    },
    {
        zagadka: "Im więcej ze mnie zabierasz, tym staję się większy. Co to jest?",
        odpowiedz: "dziura",
        wskazówka: "Można w nią wpaść na drodze."
    },
    {
        zagadka: "Nie mam głosu, a jednak mówię do wszystkich ludzi na świecie. Co to takiego?",
        odpowiedz: "książka",
        wskazówka: "Znajdziesz to na półce w bibliotece."
    },
    {
        zagadka: "Co ma cztery nogi rano, dwie w południe i trzy wieczorem?",
        odpowiedz: "człowiek",
        wskazówka: "Opisuje to całe ludzkie życie (od raczkowania, przez chodzenie, aż po laskę)."
    },
    {
        zagadka: "Co ma gardło, ale nie ma głowy?",
        odpowiedz: "butelka",
        wskazówka: "Trzymasz w tym napoje."
    },
    {
        zagadka: "Idzie przez las i nie zostawia żadnych śladów. Co to jest?",
        odpowiedz: "wiatr",
        wskazówka: "Czasami potrafi mocno przewiać włosy."
    },
    {
        zagadka: "Co potrafi podróżować po całym świecie, pozostając cały czas w tym samym rogu?",
        odpowiedz: "znaczek",
        wskazówka: "Naklejasz to na list."
    },
    {
        zagadka: "Co ma miasto, ale nie ma domów; ma las, ale nie ma drzew; ma wodę, ale nie ma ryb?",
        odpowiedz: "mapa",
        wskazówka: "Używasz tego do nawigacji."
    },
    {
        zagadka: "Co można złapać, ale nie można rzucić?",
        odpowiedz: "przeziębienie",
        wskazówka: "Dopada Cię w jesienne i zimowe dni."
    },
    {
        zagadka: "Co ma jedno oko, ale nie widzi?",
        odpowiedz: "igła",
        wskazówka: "Służy do szycia ubrań."
    },
    {
        zagadka: "Co ma ręce, ale nie potrafi klaskać?",
        odpowiedz: "zegar",
        wskazówka: "Wskazuje Ci aktualną godzinę na ścianie."
    },
    {
        zagadka: "Czego nie możesz zatrzymać, nawet jeśli należy do najcenniejszych rzeczy na świecie?",
        odpowiedz: "czas",
        wskazówka: "Nieubłaganie leci do przodu."
    },
    {
        zagadka: "Co ma zęby, ale nie potrafigryźć?",
        odpowiedz: "grzebień",
        wskazówka: "Używasz tego do czesania włosów."
    },
    {
        zagadka: "Co rośnie, kiedy je karmisz, ale umiera, gdy napoisz je wodą?",
        odpowiedz: "ogień",
        wskazówka: "Rozpalasz to w kominku lub na ognisku."
    },
    {
        zagadka: "Co ma osiem nóg, dwie macki, ale pływa w oceanie i żyje na dnie?",
        odpowiedz: "ośmiornica",
        wskazówka: "Ma głowę z mackami."
    }
];

// Zbiór do śledzenia już wysłanych zagadek (zapobiega powtórzeniom)
let wyslaneZagadki = new Set();

module.exports = (client) => {
    client.once('ready', () => {
        console.log('[4Fun] Moduł "Zgadnij Słowo" został pomyślnie uruchomiony!');

        // Główna pętla wywoływana co 1 godzinę (1 * 60 * 60 * 1000 ms)
        setInterval(async () => {
            try {
                const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
                if (!channel) return console.log('[4Fun] Nie znaleziono kanału do zgadywania słów!');

                // Sprawdzamy, czy wykorzystaliśmy już wszystkie zagadki z bazy. Jeśli tak, resetujemy pamięć.
                if (wyslaneZagadki.size >= zagadki.length) {
                    wyslaneZagadki.clear();
                }

                // Losujemy unikalną zagadkę, której jeszcze nie było
                let dostepneIndeksy = [];
                for (let i = 0; i < zagadki.length; i++) {
                    if (!wyslaneZagadki.has(i)) dostepneIndeksy.push(i);
                }

                const wylosowanyIndeks = dostepneIndeksy[Math.floor(Math.random() * dostepneIndeksy.length)];
                wyslaneZagadki.add(wylosowanyIndeks);

                const aktualnaZagadka = zagadki[wylosowanyIndeks];

                // Przygotowujemy przepiękny, luksusowy embed wizualny
                const embed = new EmbedBuilder()
                    .setAuthor({ 
                        name: 'SIDE COMMUNITY ZIOMECZKI.GG • STREFA 4FUN', 
                        iconURL: channel.guild.iconURL({ dynamic: true }) || null 
                    })
                    .setTitle('❓ • CZAS NA ZGADNIJ SŁOWO!')
                    .setDescription(
                        `> Rozruszaj swoje szare komórki! Kto pierwszy odgadnie ukryte słowo na podstawie poniższej zagadki, wygrywa tę rundę!\n\n` +
                        `🧩 **ZAGADKA:**\n` +
                        `\`\`\`text\n${aktualnaZagadka.zagadka}\`\`\`\n` +
                        `💡 **Wskazówka:** *${aktualnaZagadka.wskazówka}*\n\n` +
                        `✍️ **Jak odpowiedzieć?**\n` +
                        `*Po prostu napisz swoją odpowiedź na tym kanale! Następna zagadka pojawi się za godzinę.*`
                    )
                    .setColor('#F1C40F') // Królewski złoty kolor dla zagadek
                    .setImage('https://cdn.discordapp.com/attachments/1523090420282949662/1525868085842677800/ziomeckkigg.png?ex=6a6ea824&is=6a6d56a4&hm=491057f9ba1f7aed00ea87db30d80290040d8a370b3ba9ba4c10a87294265b65&')
                    .setFooter({ 
                        text: 'Zabawa automatyczna co 1h • Side Community Ziomeczki.gg', 
                        iconURL: client.user.displayAvatarURL() 
                    })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

            } catch (error) {
                console.error('[4Fun] Błąd podczas wysyłania zagadki:', error);
            }
        }, 60 * 60 * 1000); // 1 godzina
    });
};
