import { NextResponse } from "next/server";
import { startSession, streamStart } from "@/agent/runner";
import { errorToResponse, sseFromGenerator, wantsStream } from "@/lib/agent-api";

export const dynamic = "force-dynamic";
// a full graph pass can run tens of seconds — vercel's default 10s timeout
// would cut it off mid-generation
export const maxDuration = 60;

export async function POST(req: Request) {
  let rawIdea = "";
  try {
    const body = await req.json();
    rawIdea = typeof body?.raw_idea === "string" ? body.raw_idea : "";
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "body must be JSON with raw_idea" } },
      { status: 400 }
    );
  }

  // browser sends accept: text/event-stream and gets stage events;
  // curl and tests get plain json without asking
  if (wantsStream(req)) {
    return sseFromGenerator(streamStart(rawIdea));
  }

  try {
    const result = await startSession(rawIdea);
    return NextResponse.json(result);
  } catch (err) {
    return errorToResponse(err);
  }
}
