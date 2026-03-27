require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");
const connectDB = require("./db");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ---- Datenbank Helper ----


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
  new SlashCommandBuilder().setName("setlocation").setDescription("Put in your city")
    .addStringOption(o => o.setName("city").setDescription("City and country").setRequired(true)),
  new SlashCommandBuilder().setName("map").setDescription("Show the world map"),
  new SlashCommandBuilder().setName("removelocation").setDescription("Delete your location")
].map(c => c.toJSON());

// Register Commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }))();

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

const db = await connectDB();
const users = db.collection("users");
  const guildId = interaction.guildId;

  if (interaction.commandName === "setlocation") {
    const city = interaction.options.getString("city");
    const geo = await geocode(city);
    if (!geo) return interaction.reply("Ort nicht gefunden 😢");

    // Rollenfarbe bestimmen
    const member = interaction.member;
    const coloredRole = member.roles.cache.filter(r => r.color !== 0).sort((a,b)=>b.position-a.position).first();
    const roleColor = coloredRole ? "#" + coloredRole.color.toString(16).padStart(6,"0") : "#2ecc71";

	
await users.updateOne(
  { userId: interaction.user.id, guildId: interaction.guild.id },
  {
    $set: {
      username: interaction.member.displayName,
      location: city,
      lat: geo.lat,
      lon: geo.lon,
	  color: roleColor
    }
  },
  { upsert: true }
);
    interaction.reply(`📍 Standort gespeichert: ${city}`);
  }

  if (interaction.commandName === "removelocation") {
	const db = await connectDB();
	
await db.collection("users").deleteOne({ userId: interaction.user.id, guildId: interaction.guild.id }};
    interaction.reply("🗑️ Standort gelöscht");
	
  if (interaction.commandName === "map") {
    interaction.reply(`🌍 Karte: https://wyoucomefrom.onrender.com/?guild=${guildId}`);
  }
});

// ---- API Endpoint ----
const connectDB = require("./db");

app.get("/locations", async (req, res) => {
  const db = await connectDB();
  const users = db.collection("users");

  const data = await users.find().toArray();
  res.json(data);
});

// ---- Start Discord + Server ----

app.listen(PORT, ()=>console.log(`Server läuft auf Port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);