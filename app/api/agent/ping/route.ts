import { NextResponse } from "next/server";
import { runPing } from "@/agent/graph";

export const dynamic = "force-dynamic";

// same graph the standalone dev server runs, but through the path that
// actually ships — proves langgraph works inside a vercel function
export async function GET() {
  const result = await runPing();
  return NextResponse.json({ status: "ok", agent: result });
}
