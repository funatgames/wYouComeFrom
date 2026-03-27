const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.static("public"));

app.get("/locations/:guildId", (req, res) => {
    const db = JSON.parse(fs.readFileSync("./db.json"));
    const guild = db.guilds[req.params.guildId];

    if (!guild) return res.json([]);
    res.json(guild.users);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
//app.listen(3000, () => console.log("Webserver läuft auf 3000"));