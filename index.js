const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Captcha } = require('captcha-canvas');
const express = require('express');

// Serwer HTTP dla Render.com
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Ziomeczki.gg działa!'));
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

// Inicjalizacja bota
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

const CHANNEL_ID = '1532519461414895827';
const ROLE_REMOVE_ID = '1532514463972855858';
const ROLE_ADD_ID = '1532411605592047636';

// Tymczasowy słownik przechowujący aktywne zadania captcha dla użytkowników
const activeCaptchas = new Map();

client.on('ready', () => {
  console.log(`Zalogowano jako ${client.user.tag}!`);
});

// Komenda wysyłająca panel weryfikacyjny: wpisz !setup-weryfikacja na dowolnym kanale
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!setup-weryfikacja' && message.channel.id === CHANNEL_ID) {
    const embed = new EmbedBuilder()
      .setTitle('Weryfikacja CAPTCHA')
      .setDescription('Kliknij poniższy przycisk, aby przejść weryfikację i uzyskać dostęp do serwera.')
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_captcha')
        .setLabel('Zweryfikuj się')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete();
  }
});

// Obsługa interakcji (przyciski i wpisywanie kodu)
client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'start_captcha') {
      try {
        const captcha = new Captcha();
        captcha.async = true;
        captcha.addDecoy();
        captcha.drawTrace();
        captcha.drawCaptcha();

        const text = captcha.text;
        const buffer = await captcha.image;

        activeCaptchas.set(interaction.user.id, text);

        const attachment = new AttachmentBuilder(buffer, { name: 'captcha.png' });

        const embed = new EmbedBuilder()
          .setTitle('Przepisz kod z obrazka')
          .setDescription('Wpisz na czacie kod, który widzisz na załączonym obrazku poniżej. Masz na to 2 minuty.')
          .setImage('attachment://captcha.png')
          .setColor('Yellow');

        await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });

        // Oczekiwanie na wiadomość z kodem od użytkownika
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: 1 });

        collector.on('collect', async m => {
          await m.delete().catch(() => {});
          const userCode = m.content.trim();
          const correctCode = activeCaptchas.get(interaction.user.id);

          const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) return;

          if (userCode === correctCode) {
            activeCaptchas.delete(interaction.user.id);
            
            // Zabranie i dodanie roli
            await member.roles.remove(ROLE_REMOVE_ID).catch(console.error);
            await member.roles.add(ROLE_ADD_ID).catch(console.error);

            await interaction.followUp({ content: '✅ Pomyślnie zweryfikowano! Otrzymałeś dostęp do serwera.', ephemeral: true });
          } else {
            await interaction.followUp({ content: '❌ Błędny kod! Kliknij przycisk weryfikacji ponownie, aby spróbować jeszcze raz.', ephemeral: true });
          }
        });

      } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'Wystąpił błąd podczas generowania weryfikacji.', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
