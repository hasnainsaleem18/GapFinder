import { NextResponse } from "next/server";
import { runPing } from "@/agent/graph";

export const dynamic = "force-dynamic";

// Same graph as agent/server.ts — this route is the path that deploys
// to Vercel as a serverless function (no separate agent host needed).
export async function GET() {
  const result = await runPing();
  return NextResponse.json({ status: "ok", agent: result });
}
