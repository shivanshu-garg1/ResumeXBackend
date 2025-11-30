const express = require("express");
const router = express.Router();

const auth = require("../Controllers/authcontroller");
const protect = require("../Middleware/authmiddleware");

router.post("/signup", auth.signUp);
router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/check", protect, auth.checkAuth);


module.exports = router;
