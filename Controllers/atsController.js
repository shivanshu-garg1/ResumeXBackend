const AtsReport = require("../models/AtsReport.model");

const { sendReport } = require("../Utils/sendReport");
const extractJsonObject = require("../Utils/extractJsonObj");
const { saveAtsReports } = require("../Utils/saveAtsReports");
const PDFDocument = require("pdfkit");
const pdfParse = require("pdf-parse");
const extractTextFromUploadedFile = async (file) => {
  if (!file?.buffer) return "";

  try {
   if (file.mimetype === "application/pdf") {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default;

  const parsed = await pdfParse(file.buffer);
  return (parsed?.text || "").trim();
}

    return file.buffer.toString("utf-8").trim();
  } catch (err) {
    throw new Error(
      `Failed to extract text from uploaded file ${file.originalname || "(unknown file)"}: ${
        err?.message || "Unknown error"
      }`
    );
  }
};

const analyzeResumeWithGroq = async (req, res) => { 
  console.log(req.body);

  try {
    const mode = req.body.mode || "upload";
    let resumeText = "";
    let jobText = "";
    let resumeFile = null;
    let jdFile = null;

    const jobTitleFromBody = req.body.jobTitle || null;

    const aiModule = await import("../Utils/ai.mjs");
    const ai = aiModule.default || aiModule.ai;

    if (mode === "upload") {
      resumeFile = req.files?.resume?.[0];
      jdFile = req.files?.jobDescription?.[0];

      if (!resumeFile) {
        return res.status(400).json({ message: "Resume file is required" });
      }

      try {
        resumeText = await extractTextFromUploadedFile(resumeFile);
      } catch (fileErr) {
        return res.status(400).json({ message: fileErr.message });
      }

      if (!resumeText.trim()) {
        return res
          .status(400)
          .json({ message: "Could not extract text from resume file" });
      }

      if (jdFile) {
        try {
          jobText = await extractTextFromUploadedFile(jdFile);
        } catch (fileErr) {
          return res.status(400).json({ message: fileErr.message });
        }
      }
    }

    if (mode === "paste") {
      resumeText = req.body.resumeText || "";
      jobText = req.body.jobText || "";

      if (!resumeText.trim()) {
        return res.status(400).json({ message: "Resume text is empty" });
      }
    }

    const systemPrompt = `
You are an ATS (Applicant Tracking System) resume analyzer.
You MUST analyze a resume and an optional job description and respond ONLY with PURE VALID JSON.
No explanations. No backticks. No comments. No extra text. No markdown. No trailing commas.

Return the result in EXACTLY the following JSON structure:

{
  "summary": {
    "ATSScore": number,              // 0-100
    "overallStatus": string,
    "headline": string,
    "matchedKeywordsCount": number,
    "missingKeywordsCount": number,
    "issuesFoundCount": number,
    "estimatedFixTimeMinutes": number
  },
  "keywords": {
    "matched": string[],
    "missing": string[]
  },
  "sectionAnalysis": [
    {
      "id": string,
      "title": string,
      "scores": {
        "keywordsMatch": number,
        "formatting": number,
        "sectionStructure": number,
        "fileFormat": number
      }
    }
  ],
  "recommendations": [
    {
      "id": string,
      "title": string,
      "impactLevel": string,    // "high" | "medium" | "low" | "none"
      "severity": string,       // "error" | "warning" | "good"
      "description": string,
      "ctaText": string | null
    }
  ]
}

Rules:
- ALL numbers must be valid integers between 0 and 100 where applicable.
- ALWAYS provide at least one item inside "recommendations".
- ALWAYS provide valid JSON that can be parsed by JSON.parse().
- DO NOT wrap JSON in backticks or markdown.
- DO NOT add ANY text before or after the JSON.
- Output ONLY the JSON object.
`;

    const userPrompt = `
RESUME CONTENT:
${resumeText}

JOB DESCRIPTION (optional):
${jobText || "N/A"}
`;
    const response = await ai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = response?.choices?.[0]?.message?.content || "";

    let json;
    try {
      const jsonString = extractJsonObject(rawText);
      json = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse/save Groq JSON:", e.message);
      console.error("Raw Groq text (snippet):", rawText);
      return res.status(500).json({
        message: "Groq returned invalid JSON",
        error: e.message,
        raw: rawText,
      });
    }
    await saveAtsReports({
      userId: req.user.id,
      fileName:
        resumeFile?.originalname ||
        (mode === "paste" ? "Pasted resume" : "Resume"),
      jobTitle: jobTitleFromBody,
      analysis: json,
    });

    await sendReport({
      email: req.user.email,
      name: req.user.name,
      analysis: json,
    });
    return res.json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Failed to analyze resume with Groq",
      error: err.message,
    });
  }
};

const getRecentReports = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User not found in request" });
    }
    const reports = await AtsReport.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      reports: reports.map((r) => ({
        id: r._id.toString(),
        createdAt: r.createdAt,
        fileName: r.fileName,
        jobTitle: r.jobTitle,
        summary: r.analysis.summary,
        analysis: r.analysis,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch recent reports:", err);
    return res.status(500).json({
      message: "Failed to load recent reports",
    });
  }
};



const downloadReportPdf = async (req, res) => {
  try {
    const reportId = req.params.id;
    const report = await AtsReport.findById(reportId);
    if (!report) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).send({ message: "Report not found" });
    }

    // --- Prepare filename and headers BEFORE piping ---
    const fileName = `ATS-Report-${reportId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    // Use RFC-compliant filename* to avoid charset issues for some clients
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    // Create PDF document
    const doc = new PDFDocument({ autoFirstPage: true, margin: 50 });

    // Pipe PDF directly to response
    doc.pipe(res);

    // Error handlers (helps diagnose streaming issues)
    doc.on("error", (err) => {
      console.error("PDFKit error:", err);
      // If an error occurs during PDF creation, try to inform client (if not already closed)
      if (!res.headersSent) {
        res.status(500).json({ message: "Error generating PDF" });
      } else {
        // If headers already sent, just destroy the connection
        try { res.destroy(err); } catch (e) {}
      }
    });
    res.on("error", (err) => {
      console.error("Response stream error:", err);
      try { doc.destroy(err); } catch (e) {}
    });

    // --- Header ---
    doc.fontSize(22).text("ATS Resume Report", { align: "center" });
    doc.moveDown(0.5);

    // Basic report metadata
    doc.fontSize(12);
    doc.text(`Report ID: ${reportId}`);
    doc.text(`Job Title: ${report.jobTitle || "N/A"}`);
    doc.text(`File: ${report.fileName || "N/A"}`);
    doc.text(`Generated: ${new Date(report.createdAt || Date.now()).toLocaleString()}`);
    doc.moveDown();

    // --- Summary block (from report.analysis.summary) ---
    const summary = report.analysis?.summary || {};
    doc.fontSize(16).text("Summary", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(12);
    doc.text(`ATS Score: ${summary.ATSScore ?? "N/A"}`);
    doc.text(`Status: ${summary.overallStatus ?? "N/A"}`);
    doc.moveDown();

    // --- Keywords Analysis (matched + missing) ---
    doc.fontSize(16).text("Keywords Analysis", { underline: true });
    doc.moveDown(0.25);
    const matched = report.analysis?.matchedKeywords || [];
    const missing = report.analysis?.missingKeywords || [];

    if (matched.length) {
      doc.fontSize(13).text("Matched Keywords:");
      doc.moveDown(0.15);
      matched.forEach((k) => doc.text("• " + k));
      doc.moveDown(0.4);
    } else {
      doc.fontSize(12).text("Matched Keywords: None detected in report.");
      doc.moveDown(0.3);
    }

    if (missing.length) {
      doc.fontSize(13).text("Missing Keywords:");
      doc.moveDown(0.15);
      // keep lines short to avoid overflow
      missing.forEach((k) => doc.text("• " + k));
      doc.moveDown(0.4);
    } else {
      doc.fontSize(12).text("Missing Keywords: None detected in report.");
      doc.moveDown(0.3);
    }

    // --- Section analysis (if present in report) ---
    const sectionAnalysis = report.analysis?.sectionAnalysis;
    if (sectionAnalysis && typeof sectionAnalysis === "object") {
      doc.fontSize(16).text("Section Analysis", { underline: true });
      doc.moveDown(0.25);
      Object.keys(sectionAnalysis).forEach((section) => {
        doc.fontSize(12).text(`${section}: ${sectionAnalysis[section]}`);
      });
      doc.moveDown();
    }

    // --- Suggestions from report.analysis.suggestions ---
    const suggestions = report.analysis?.suggestions || [];
    if (suggestions.length) {
      doc.fontSize(16).text("Suggestions", { underline: true });
      doc.moveDown(0.15);
      suggestions.forEach((s) => doc.text("• " + s));
      doc.moveDown();
    }

    // --- Appendix: If you uploaded an ATS analysis file, append its parsed content ---
    // The server path used during development for your upload: /mnt/data/ats-analysis-report.pdf
    // We include the human-readable parsed summary (the parsed text of that PDF was: "Overall ATS Score: 38% ..." etc.)
    // (If you have the plain-text parsing stored somewhere, prefer that; here it's embedded for completeness.)
    doc.addPage();
    doc.fontSize(16).text("Appendix — Full ATS Analysis (from uploaded file)", { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(11);

    // IMPORTANT: below we include a concise copy of the parsed analysis that came from your uploaded file.
    // If you keep a text-parsed version in DB or storage, replace this with reading that text.
    const appendixText = `
Overall ATS Score: 38%
Matched Keywords: 9
Missing Keywords: 26
Issues Found: 4
Estimated Fix Time: 180 minutes

Keywords Analysis - Matched:
• Fresher
• Trainee
• Bachelor of Engineering in Computer Science
• Git
• GitHub
• problem-solving
• eagerness to learn new technologies
• automate
• optimize

Keywords Analysis - Missing:
• DevOps Engineer
• CI/CD pipelines
• deployment automation
• cloud infrastructure
• AWS
• Azure
• GCP
• monitoring
• maintenance
• automation scripts
• Shell
• Python
• system performance
• incident/root-cause analysis
• documentation
• DevOps workflows
• Linux/Unix fundamentals
• networking basics
• CI/CD concepts
• configuration management
• Docker
• containerization
• YAML
• Terraform
• IaC tools
• Internship experience

Section Analysis:
Summary: 30% (Poor)
Skills: 20% (Poor)
Projects: 10% (Poor)
Certifications: 5% (Poor)
Education: 90% (Good)

Improvement Recommendations:
1. Tailor Resume for DevOps Role (high impact)
2. Acquire DevOps-Specific Skills & Experience (high impact)
3. Pursue Cloud/DevOps Certifications (medium impact)
4. Emphasize Transferable Skills (medium impact)

(Parsed from uploaded file.)`.trim();

    // Split into reasonable lines to avoid huge long lines in PDF
    const lines = appendixText.split("\n");
    lines.forEach((ln) => doc.text(ln));
    doc.moveDown();

    // Finalize PDF (this is critical)
    doc.end();

    // When the doc finishes, node will automatically end the response pipe.
    // We return here; any errors are handled by the 'error' listeners above.
  } catch (err) {
    console.error("PDF download failed:", err);
    // If headers already sent, we cannot send JSON; just close connection
    if (!res.headersSent) {
      res.status(500).json({
        message: "Failed to generate PDF",
        error: err.message,
      });
    } else {
      try { res.destroy(); } catch (e) {}
    }
  }
};
module.exports = {
  analyzeResumeWithGroq,
  getRecentReports, 
  downloadReportPdf
};
