import { ChatGroq } from "@langchain/groq";

// groq free tier only — swap this out if we ever need something heavier.
// llama-3.3-70b does tool calling + json mode, which extraction and doc
// generation both lean on. GROQ_MODEL env var overrides the default.
export function getModel() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set — add it to .env.local");
  }

  return new ChatGroq({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    temperature: 0, // extraction needs to be repeatable, not creative
  });
}
