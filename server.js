// server.js
require("./Config/env");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");


const connectDB = require("./Config/db");


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use(
  cors({
    origin: [
      "https://resumex-flax.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const authRoutes = require("./Routes/authRoutes");
const atsRoutes = require("./Routes/atsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/ats", atsRoutes);


const startServer = async () => {
  try {
    await connectDB();
    app.listen(process.env.PORT, () => {
      console.log(`Server started at ${process.env.PORT}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

startServer();
