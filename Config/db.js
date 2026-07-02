
const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured.");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log("Db connected");
  } catch (err) {
    const message = err?.message || "Unknown MongoDB connection error";
    throw new Error(`MongoDB connection failed: ${message}`);
  }
};

module.exports = connectDB;