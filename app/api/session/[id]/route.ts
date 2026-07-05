import { NextResponse } from "next/server";
import { loadSession } from "@/agent/runner";
import { loadLatestDoc } from "@/agent/db";
import { errorToResponse } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const snapshot = await loadSession(id);
    if (!snapshot) {
      return NextResponse.json(
        { error: { code: "unknown_session", message: `unknown session: ${id}` } },
        { status: 404 }
      );
    }

    const doc =
      snapshot.status === "complete" ? await loadLatestDoc(id) : null;

    return NextResponse.json({
      sessionId: snapshot.sessionId,
      status: snapshot.status,
      rawIdea: snapshot.rawIdea,
      gaps: snapshot.gaps,
      qaHistory: snapshot.qaHistory,
      doc,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
