import { ChatGroq } from "@langchain/groq";

/**
 * The LLM behind the agent. Groq free tier; model overridable via GROQ_MODEL.
 * llama-3.3-70b-versatile supports tool calling and JSON mode — both needed
 * for the structured clarification loop.
 */
export function getModel() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set — add it to .env.local");
  }

  return new ChatGroq({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    temperature: 0,
  });
}
