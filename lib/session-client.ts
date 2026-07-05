import type { RoundResult } from "@/agent/runner";
import type { GapReport, RequirementsDoc } from "@/agent/schemas";
import type { QaEntry } from "@/agent/db";

/** Browser-side wrapper for the session API. SSE is consumed via fetch +
 *  ReadableStream because EventSource cannot POST. */

export type SessionState = {
  sessionId: string;
  status: "gathering" | "complete";
  rawIdea: string;
  gaps: GapReport;
  qaHistory: QaEntry[];
  doc: RequirementsDoc | null;
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function throwFromResponse(res: Response): Promise<never> {
  let code = "internal_error";
  let message = `request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch {
    // non-JSON error body — keep defaults
  }
  throw new ApiError(code, message, res.status);
}

/** POST with SSE streaming: reports stage labels, resolves with the result. */
async function postStreaming(
  url: string,
  payload: unknown,
  onStage?: (label: string) => void
): Promise<RoundResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    return throwFromResponse(res);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RoundResult | null = null;

  const handleBlock = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const parsed = JSON.parse(data);
    if (event === "stage") onStage?.(parsed.label);
    else if (event === "result") result = parsed as RoundResult;
    else if (event === "error") {
      throw new ApiError(
        parsed.code ?? "internal_error",
        parsed.message ?? "the agent failed",
        parsed.status
      );
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (block.trim()) handleBlock(block);
    }
  }

  if (!result) {
    throw new ApiError("internal_error", "stream ended without a result");
  }
  return result;
}

export function startSession(
  rawIdea: string,
  onStage?: (label: string) => void
): Promise<RoundResult> {
  return postStreaming("/api/session/start", { raw_idea: rawIdea }, onStage);
}

export function submitAnswer(
  sessionId: string,
  answer: string,
  onStage?: (label: string) => void
): Promise<RoundResult> {
  return postStreaming(`/api/session/${sessionId}/answer`, { answer }, onStage);
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`/api/session/${sessionId}`);
  if (!res.ok) return throwFromResponse(res);
  return res.json();
}
