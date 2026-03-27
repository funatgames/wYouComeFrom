require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");
const connectDB = require("./db");

const app = express();
app.use(express.static("public"));

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");

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

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("Slash commands registered ✅");
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   EXPRESS API
========================= */

app.get("/locations", async (req, res) => {
  try {
    const db = await connectDB();
    const users = db.collection("users");

    const data = await users.find({}).toArray();

    res.json(data);
  } catch (err) {
    console.error("Locations API error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---- Start Discord + Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server läuft auf Port ${PORT}`));

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function geocode(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "discord-worldmap-bot"
    }
  });

  const data = await res.json();
  if (!data[0]) return null;

  return {
    lat: data[0].lat,
    lon: data[0].lon,
  };
}

client.once("ready", async () => {
  console.log("Bot ready");
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setlocation") {
    const location = interaction.options.getString("location");

    await interaction.reply("Searching location... 🌍");

    const coords = await geocode(location);
    if (!coords) {
      return interaction.editReply("Location not found 😢");
    }

    const db = await connectDB();
    const users = db.collection("users");

    await users.updateOne(
      { userId: interaction.user.id, guildId: interaction.guild.id },
      {
        $set: {
          username: interaction.member.displayName,
          location,
          lat: parseFloat(coords.lat),
          lon: parseFloat(coords.lon)
        }
      },
      { upsert: true }
    );

    interaction.editReply("Location saved ✅");
  }
  
  if (interaction.commandName === "map") {
    interaction.reply(
       `🌍 Karte: https://wyoucomefrom.onrender.com/`
    );
  }
  
  if (interaction.commandName === "removelocation") {
  const db = await connectDB();
  const users = db.collection("users");

  const result = await users.deleteOne({
    userId: interaction.user.id,
    guildId: interaction.guild.id
  });

  if (result.deletedCount === 0) {
    return interaction.reply({
      content: "❌ You don't have a location saved.",
      ephemeral: true
    });
  }

  interaction.reply({
    content: "✅ Your location has been removed from the map.",
    ephemeral: true
  });
  }
});

client.login(process.env.DISCORD_TOKEN);