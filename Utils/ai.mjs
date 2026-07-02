import Groq from "groq-sdk";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is not set in environment variables");
}

export const ai = new Groq({
  apiKey: GROQ_API_KEY,
});

export default ai;
