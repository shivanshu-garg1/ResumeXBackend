// utils/ai.mjs
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

// This is the new-style client
// Docs: https://googleapis.github.io/js-genai/ :contentReference[oaicite:0]{index=0}
export const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  // apiVersion: "v1" // optional, default is beta
});

export default ai;
