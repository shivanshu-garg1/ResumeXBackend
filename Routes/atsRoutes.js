const express = require("express");
const { analyzeResumeWithGemini,getRecentReports } = require("../Controllers/atsController");
const protect = require("../Middleware/authmiddleware");
const upload = require("../Middleware/multer");

const router = express.Router();

router.post(
  "/upload",
  protect,
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "jobDescription", maxCount: 1 },
  ]),
  analyzeResumeWithGemini
);
router.get("/recent", protect, getRecentReports);
module.exports = router;
