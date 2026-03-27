require("dotenv").config();
const fs = require("fs");
const DB_FILE = "./db.json";

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ---- Datenbank Helper ----
function ensureDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ todos: [] }, null, 2));
  }
}

function loadDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(data) { fs.writeFileSync("./db.json", JSON.stringify(data, null, 2)); }

// ---- Geocoding ----
async function geocode(city) {
  try {
    const url = "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({ q: city, format: "json", limit: 1 });

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "DiscordWorldMapBot/1.0 (alex.klemm123@gmail.com)",
        "Accept": "application/json",
        "Accept-Language": "en"
      }
    });

    const text = await res.text();
    if (!text.startsWith("[")) return null;

    const data = JSON.parse(text);
    if (!data.length) return null;

    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

// ---- Discord Commands ----
const commands = [
  new SlashCommandBuilder().setName("setlocation").setDescription("Setze deine Stadt")
    .addStringOption(o => o.setName("city").setDescription("Stadt + Land").setRequired(true)),
  new SlashCommandBuilder().setName("map").setDescription("Zeigt die Weltkarte"),
  new SlashCommandBuilder().setName("removelocation").setDescription("Löscht deine gespeicherte Location")
].map(c => c.toJSON());

// Register Commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }))();

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const db = loadDB();
  const guildId = interaction.guildId;
  const guildName = interaction.guild.name;

  if (!db.guilds[guildId]) db.guilds[guildId] = { name: guildName, users: [] };
  const guild = db.guilds[guildId];

  if (interaction.commandName === "setlocation") {
    const city = interaction.options.getString("city");
    const geo = await geocode(city);
    if (!geo) return interaction.reply("Ort nicht gefunden 😢");

    // Rollenfarbe bestimmen
    const member = interaction.member;
    const coloredRole = member.roles.cache.filter(r => r.color !== 0).sort((a,b)=>b.position-a.position).first();
    const roleColor = coloredRole ? "#" + coloredRole.color.toString(16).padStart(6,"0") : "#2ecc71";

    guild.users = guild.users.filter(u => u.id !== interaction.user.id);
    guild.users.push({
      id: interaction.user.id,
      name: interaction.member.displayName,
      username: interaction.user.username,
      city,
      lat: geo.lat,
      lon: geo.lon,
      color: roleColor
    });

    saveDB(db);
    interaction.reply(`📍 Standort gespeichert: ${city}`);
  }

  if (interaction.commandName === "removelocation") {
    guild.users = guild.users.filter(u => u.id !== interaction.user.id);
    saveDB(db);
    interaction.reply("🗑️ Standort gelöscht");
  }

  if (interaction.commandName === "map") {
    interaction.reply(`🌍 Karte: https://wyoucomefrom.onrender.com/?guild=${guildId}`);
  }
});

// ---- API Endpoint ----
app.get("/locations/:guildId", (req,res)=>{
  const db = loadDB();
  const guild = db.guilds[req.params.guildId];
  if (!guild) return res.json([]);
  res.json(guild.users);
});

// ---- Start Discord + Server ----
client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, ()=>console.log(`Server läuft auf Port ${PORT}`));