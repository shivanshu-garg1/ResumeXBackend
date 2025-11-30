const mongoose = require("mongoose");

const AtsReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileName: String,
    jobTitle: String,
    analysis: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AtsReport", AtsReportSchema);
