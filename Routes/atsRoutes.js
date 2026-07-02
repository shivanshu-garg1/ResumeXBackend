const express = require("express");
const {
  analyzeResumeWithGroq,
  getRecentReports,
  downloadReportPdf,
} = require("../Controllers/atsController");
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
  analyzeResumeWithGroq
);
router.get("/recent", protect, getRecentReports);
router.get("/report/:id/full-download", downloadReportPdf);

module.exports = router;
