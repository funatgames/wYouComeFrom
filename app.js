require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");
const connectDB = require("./db");

const app = express();
app.use(express.static("public"));

/* =========================
   EXPRESS API
========================= */

app.get("/locations", async (req, res) => {
  const db = await connectDB();
  const users = db.collection("users");
  const data = await users.find().toArray();
  res.json(data);
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

client.once("ready", () => {
  console.log("Bot ready");
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
	
    await db.collection("users").deleteOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    interaction.reply("🗑️ Standort gelöscht");
  }
});

client.login(process.env.DISCORD_TOKEN);