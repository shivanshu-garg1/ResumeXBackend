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
  // origin: [
  //   "http://localhost:8080",
  //   "https://resumex-pearl.vercel.app"
  // ],
    origin: `http://localhost:8080`,
    credentials: true,
  })
);
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
