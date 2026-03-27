require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch");
const fs = require("fs");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName("setlocation")
    .setDescription("Setze deine Stadt")
    .addStringOption(o =>
      o.setName("city").setDescription("Stadt + Land").setRequired(true)),

  new SlashCommandBuilder()
    .setName("map")
    .setDescription("Zeigt die Weltkarte"),

  new SlashCommandBuilder()
    .setName("removelocation")
    .setDescription("Löscht deine gespeicherte Location")
].map(cmd => cmd.toJSON());

// Commands registrieren
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
})();

function loadDB() {
  return JSON.parse(fs.readFileSync("./db.json"));
}
function saveDB(data) {
  fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
}

// Geocoding via OpenStreetMap
async function geocode(city) {
    try {
        const url =
            "https://nominatim.openstreetmap.org/search?" +
            new URLSearchParams({
                q: city,
                format: "json",
                limit: 1
            });

        const res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "DiscordWorldMapBot/1.0 (alex.klemm321@gmail.com)",
                "Accept": "application/json",
                "Accept-Language": "en"
            }
        });

        // 🔴 WICHTIG: Fehlerseite abfangen bevor JSON geparsed wird
        const text = await res.text();

        if (!text.startsWith("[")) {
            console.log("Nominatim error response:", text);
            return null;
        }

        const data = JSON.parse(text);
        if (!data.length) return null;

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };

    } catch (err) {
        console.error("Geocode error:", err);
        return null;
    }
}
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

    const db = loadDB();
    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    if (!db.guilds[guildId]) {
        db.guilds[guildId] = {
            name: guildName,
            users: []
        };
    }

    const guild = db.guilds[guildId];

  if (interaction.commandName === "setlocation") {
    const city = interaction.options.getString("city");
    const geo = await geocode(city);

    if (!geo) return interaction.reply("Ort nicht gefunden 😢");

      /* db.users = db.users.filter(u => u.id !== interaction.user.id);

      const member = interaction.member;

      // höchste Rolle mit Farbe finden
      const coloredRole = member.roles.cache
          .filter(r => r.color !== 0)
          .sort((a, b) => b.position - a.position)
          .first();

      const roleColor = coloredRole
          ? "#" + coloredRole.color.toString(16).padStart(6, "0")
          : "#2ecc71"; // fallback grün

    db.users.push({
      id: interaction.user.id,
      name: interaction.member.displayName,
      city,
      lat: geo.lat,
        lon: geo.lon,
        color: roleColor
    }); */

      guild.users = guild.users.filter(u => u.id !== interaction.user.id);
      const member = interaction.member;

      // höchste Rolle mit Farbe finden
      const coloredRole = member.roles.cache
          .filter(r => r.color !== 0)
          .sort((a, b) => b.position - a.position)
          .first();

      const roleColor = coloredRole
          ? "#" + coloredRole.color.toString(16).padStart(6, "0")
          : "#2ecc71"; // fallback grün
      guild.users.push({
          id: interaction.user.id,
          name: interaction.member.displayName,
          city,
          lat: geo.lat,
          lon: geo.lon,
          color: roleColor
      });

    saveDB(db);
    interaction.reply(`📍 Standort gespeichert: ${city}`);
  }

  if (interaction.commandName === "map") {
      interaction.reply(
          `🌍 Karte: http://localhost:3000/?guild=${interaction.guildId}`
      );
  }

  if (interaction.commandName === "removelocation") {
      const guildId = interaction.guildId;
      if (!db.guilds[guildId]) return interaction.reply("Keine Daten vorhanden.");

      db.guilds[guildId].users =
          db.guilds[guildId].users.filter(u => u.id !== interaction.user.id);
    saveDB(db);
    interaction.reply("🗑️ Standort gelöscht");
  }
});

client.login(process.env.DISCORD_TOKEN);