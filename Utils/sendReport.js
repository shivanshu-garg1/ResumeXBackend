const { generateReportPdf } = require("../Utils/reportPdf");
const { sendEmail } = require("../Utils/sendEmail");

const sendReport = async ({ email, name, analysis }) => {
  try {
    if (!email) {
      console.warn("sendReport called without email. Skipping email send.");
      return;
    }

    const pdfBuffer = await generateReportPdf(analysis);

    await sendEmail(
      email,
      "Your AIResumeX ATS Analysis Report",
      `Hi ${name || ""},

Your ATS analysis report is attached as a PDF.

Best regards,
AIResumeX`,
      {
        attachments: [
          {
            filename: "ats-analysis-report.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      }
    );

    console.log("ATS report email sent to:", email);
  } catch (emailErr) {
    console.error("Failed to generate/send ATS report PDF:", emailErr);
  }
};

module.exports = { sendReport };
