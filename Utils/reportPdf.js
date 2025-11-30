// Utils/reportPdf.js
const PDFDocument = require("pdfkit");

/**
 * Generate a PDF buffer from ATS analysis JSON.
 * @param {object} analysis - The ATS analysis object returned by Gemini.
 * @returns {Promise<Buffer>}
 */
function generateReportPdf(analysis) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const summary = analysis.summary || {};
    const keywords = analysis.keywords || { matched: [], missing: [] };
    const sectionAnalysis = analysis.sectionAnalysis || [];
    const recommendations = analysis.recommendations || [];

    const overallScore = summary.ATSScore ?? 0;
    const matchedKeywords = keywords.matched || [];
    const missingKeywords = keywords.missing || [];

    // ====== PDF CONTENT ======

    // Title
    doc
      .fontSize(20)
      .text("ATS Analysis Report", { align: "center" })
      .moveDown(1.5);

    // Summary
    doc.fontSize(12).text(`Overall ATS Score: ${overallScore}%`);
    doc.text(`Matched Keywords: ${matchedKeywords.length}`);
    doc.text(`Missing Keywords: ${missingKeywords.length}`);

    if (summary.issuesFoundCount !== undefined) {
      doc.text(`Issues Found: ${summary.issuesFoundCount}`);
    }
    if (summary.estimatedFixTimeMinutes !== undefined) {
      doc.text(
        `Estimated Fix Time: ${summary.estimatedFixTimeMinutes} minutes`
      );
    }

    doc.moveDown(1);

    // Keywords
    doc.fontSize(14).text("Keywords Analysis", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text("Matched Keywords:");
    if (matchedKeywords.length === 0) {
      doc.text("  - None");
    } else {
      matchedKeywords.forEach((kw) => doc.text(`  • ${kw}`));
    }

    doc.moveDown(0.5);

    doc.text("Missing Keywords:");
    if (missingKeywords.length === 0) {
      doc.text("  - None");
    } else {
      missingKeywords.forEach((kw) => doc.text(`  • ${kw}`));
    }

    doc.moveDown(1);

    // Section Analysis
    if (sectionAnalysis.length) {
      doc.fontSize(14).text("Section Analysis", { underline: true });
      doc.moveDown(0.5);

      sectionAnalysis.forEach((section) => {
        const title = section.title || section.id || "Section";
        const score = section.scores?.keywordsMatch ?? 0;

        let status;
        if (score >= 80) status = "Good";
        else if (score >= 50) status = "Needs Improvement";
        else status = "Poor";

        doc
          .fontSize(12)
          .text(`${title}: ${score}% (${status})`)
          .moveDown(0.2);
      });

      doc.moveDown(1);
    }

    // Recommendations
    if (recommendations.length) {
      doc.fontSize(14).text("Improvement Recommendations", {
        underline: true,
      });
      doc.moveDown(0.5);

      recommendations.forEach((rec, index) => {
        const type = rec.severity || rec.type || "info";
        const impact = rec.impactLevel || rec.impact || "N/A";

        doc
          .fontSize(12)
          .text(
            `${index + 1}. ${rec.title} [${type.toUpperCase()} | ${impact} impact]`
          );
        doc.moveDown(0.2);

        if (rec.description) {
          doc
            .fontSize(11)
            .text(rec.description, { indent: 20, width: 500 })
            .moveDown(0.4);
        }
      });
    }

    doc.end();
  });
}

module.exports = { generateReportPdf };
