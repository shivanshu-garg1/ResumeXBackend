const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const dotenv = require("dotenv");
const connectDB = require("./config/db");


dotenv.config();
connectDB();

const app = express();
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use(
  cors({
    origin: `http://localhost:8080`,
    credentials: true,
  })
);
const authRoutes = require("./Routes/authRoutes");
const atsRoutes = require("./Routes/atsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/ats", atsRoutes);


app.listen(process.env.PORT, () => {
  console.log(`Server started at ${process.env.PORT}`);
});
