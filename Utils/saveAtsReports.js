const AtsReport = require("../models/AtsReport.model");

const saveAtsReports = async ({ userId, fileName, jobTitle, analysis }) => {
  try {
    if (!userId) {
      console.warn("Missing userId. Skipping saving ATS report.");
      return;
    }

    await AtsReport.create({
      userId,
      fileName,
      jobTitle,
      analysis,
    });

  } catch (err) {
    console.error("Failed to save ATS report:", err);
  }
};

module.exports = { saveAtsReports };
