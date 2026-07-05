import { NextResponse } from "next/server";
import { submitAnswer, streamAnswer } from "@/agent/runner";
import { errorToResponse, sseFromGenerator, wantsStream } from "@/lib/agent-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let answer = "";
  try {
    const body = await req.json();
    answer = typeof body?.answer === "string" ? body.answer : "";
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "body must be JSON with answer" } },
      { status: 400 }
    );
  }

  if (wantsStream(req)) {
    return sseFromGenerator(streamAnswer(id, answer));
  }

  try {
    const result = await submitAnswer(id, answer);
    return NextResponse.json(result);
  } catch (err) {
    return errorToResponse(err);
  }
}
