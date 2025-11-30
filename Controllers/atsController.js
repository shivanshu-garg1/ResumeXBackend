const { Blob } = require("buffer");
const AtsReport = require("../models/AtsReport.model");

const  {sendReport}  = require("../Utils/sendReport");
const  extractJsonObject  = require("../Utils/extractJsonObj");
const {saveAtsReports} = require("../Utils/saveAtsReports");


const analyzeResumeWithGemini = async (req, res) => {
  // console.log(req.user.id);

  try {
    const mode = req.body.mode || "upload";
    let resumeText = "";
    let jobText = "";
    const fileParts = [];

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

      const resumeBlob = new Blob([resumeFile.buffer], {
        type: resumeFile.mimetype,
      });

      const uploadedResume = await ai.files.upload({
        file: resumeBlob,
        config: {
          mimeType: resumeFile.mimetype,
          displayName: resumeFile.originalname || "resume",
        },
      });

      fileParts.push(
        { text: "This is the candidate resume file (PDF or document)." },
        {
          fileData: {
            fileUri: uploadedResume.uri || uploadedResume.name,
            mimeType: uploadedResume.mimeType || resumeFile.mimetype,
          },
        }
      );

      if (jdFile) {
        if (
          jdFile.mimetype === "application/pdf" ||
          jdFile.mimetype === "text/plain"
        ) {
          const jdBlob = new Blob([jdFile.buffer], {
            type: jdFile.mimetype,
          });

          const uploadedJD = await ai.files.upload({
            file: jdBlob,
            config: {
              mimeType: jdFile.mimetype,
              displayName: jdFile.originalname || "job-description",
            },
          });

          fileParts.push(
            { text: "This is the job description file." },
            {
              fileData: {
                fileUri: uploadedJD.uri || uploadedJD.name,
                mimeType: uploadedJD.mimeType || jdFile.mimetype,
              },
            }
          );
        } else {
          jobText = jdFile.buffer.toString("utf-8");
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

    let contents;

    if (mode === "paste") {
      const userPrompt = `
RESUME CONTENT:
${resumeText}

JOB DESCRIPTION (optional):
${jobText || "N/A"}
`;
      contents = systemPrompt + "\n\n" + userPrompt;
    } else {
      const introText = `
You will receive the resume as an attached file (and optionally a job description as a file or as plain text).
Use the file contents when doing the ATS analysis and follow the JSON schema exactly.
`;

      const parts = [systemPrompt, introText, ...fileParts];

      if (jobText) {
        parts.push(
          "Job description text provided by the user:\n" + jobText.trim()
        );
      }

      contents = parts;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    const rawText =
      typeof response.text === "function" ? response.text() : response.text;

    let json;
    try {
      const jsonString = extractJsonObject(rawText);
      json = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse/save Gemini JSON:", e.message);
      console.error("Raw Gemini text (snippet):", rawText);
      return res.status(500).json({
        message: "Gemini returned invalid JSON",
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
      message: "Failed to analyze resume with Gemini",
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

module.exports = {
  analyzeResumeWithGemini,
  getRecentReports,
};
