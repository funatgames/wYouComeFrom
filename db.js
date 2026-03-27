const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db = null;

async function connectDB() {
  if (db) return db;

  await client.connect();
  db = client.db("discord-worldmap");
  console.log("MongoDB connected");
  return db;
}

module.exports = connectDB;