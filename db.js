const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("❌ MONGO_URI missing in environment variables!");
}

const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    if (db) return db;

    await client.connect();
    db = client.db("discord-worldmap");
    console.log("✅ MongoDB connected");

    return db;
  } catch (err) {
    console.error("❌ Mongo connection failed:", err);
    throw err;
  }
}

module.exports = connectDB;