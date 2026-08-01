const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = './autoroles.json';

// --- INICJALIZACJA BAZY DANYCH AUTORÓL ---
// Jeśli plik nie istnieje, bot sam go stworzy podczas pierwszego uruchomienia
if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify([]));
}

module.exports = (client) => {

    // 1. KOMENDY ZARZĄDZANIA (!autorola add / !autorola remove)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args[0].toLowerCase();

        if (command === '!autorola') {
            // Zabezpieczenie: Tylko osoby z uprawnieniem Administratora mogą to klikać
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply({ content: '❌ Odmowa dostępu: Tylko Administrator może zarządzać autorolami.' });
            }

            const action = args[1]?.toLowerCase();
            const roleId = args[2];

            // Weryfikacja poprawności komendy
            if (!action || !['add', 'remove'].includes(action) || !roleId) {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🛠️ System Autoroli - Pomoc')
                    .setDescription('Użyj poniższych komend, aby zarządzać rolami na start:\n\n' +
                                    '`!autorola add <ID_ROLI>` - dodaje rolę do listy\n' +
                                    '`!autorola remove <ID_ROLI>` - usuwa rolę z listy')
                    .setColor('#3498DB');
                return message.channel.send({ embeds: [helpEmbed] });
            }

            // Sprawdzamy czy taka rola w ogóle istnieje na serwerze
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply({ content: '❌ Błąd: Nie znaleziono roli o takim ID na tym serwerze.' });
            }

            // Wczytanie obecnej listy ról z pliku JSON
            let autoroles = JSON.parse(fs.readFileSync(path, 'utf8'));

            // DODAWANIE ROLI
            if (action === 'add') {
                if (autoroles.includes(roleId)) {
                    return message.reply({ content: '⚠️ Ta rola jest już na liście automatycznych ról.' });
                }
                
                autoroles.push(roleId);
                fs.writeFileSync(path, JSON.stringify(autoroles, null, 2));

                const addEmbed = new EmbedBuilder()
                    .setTitle('✅ Sukces! Dodano Autorolę')
                    .setDescription(`Od teraz rola ${role} (\`${role.name}\`) będzie automatycznie nadawana każdemu nowemu członkowi serwera.`)
                    .setColor('#2ECC71');
                return message.channel.send({ embeds: [addEmbed] });
            }

            // USUWANIE ROLI
            if (action === 'remove') {
                if (!autoroles.includes(roleId)) {
                    return message.reply({ content: '⚠️ Błąd: Tej roli nie ma aktualnie na liście.' });
                }

                autoroles = autoroles.filter(id => id !== roleId);
                fs.writeFileSync(path, JSON.stringify(autoroles, null, 2));

                const removeEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Usunięto Autorolę')
                    .setDescription(`Rola ${role} (\`${role.name}\`) została usunięta z systemu i nie będzie już nadawana przy wejściu.`)
                    .setColor('#E74C3C');
                return message.channel.send({ embeds: [removeEmbed] });
            }
        }
    });

    // 2. AUTOMATYCZNE NADAWANIE RÓL PRZY WEJŚCIU GRACZA
    client.on('guildMemberAdd', async (member) => {
        try {
            // Wczytujemy zaktualizowaną listę
            let autoroles = JSON.parse(fs.readFileSync(path, 'utf8'));
            if (autoroles.length === 0) return; // Jeśli lista jest pusta, ignorujemy

            const rolesToAdd = [];
            for (const roleId of autoroles) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    rolesToAdd.push(role);
                }
            }

            // Nadajemy wszystkie role za jednym zamachem, jeśli jakieś znaleziono
            if (rolesToAdd.length > 0) {
                await member.roles.add(rolesToAdd);
            }
        } catch (error) {
            console.error('Błąd podczas automatycznego nadawania ról:', error);
        }
    });
};
