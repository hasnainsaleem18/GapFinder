import { NextResponse } from "next/server";
import { RunnerError, type RoundEvent } from "@/agent/runner";

/**
 * HTTP glue for the session API routes: error-code → status mapping and
 * SSE wrapping for the runner's streaming generators.
 */

const STATUS_BY_CODE: Record<string, number> = {
  invalid_input: 400,
  unknown_session: 404,
  session_complete: 409,
  no_open_question: 409,
  agent_failure: 502,
};

type ApiError = { code: string; message: string };

function toApiError(err: unknown): { status: number; body: { error: ApiError } } {
  if (err instanceof RunnerError) {
    return {
      status: STATUS_BY_CODE[err.code] ?? 500,
      body: { error: { code: err.code, message: err.message } },
    };
  }
  console.error("[session api] unexpected error:", err);
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "Something went wrong on our side. Please try again.",
      },
    },
  };
}

export function errorToResponse(err: unknown): NextResponse {
  const { status, body } = toApiError(err);
  return NextResponse.json(body, { status });
}

export function wantsStream(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("text/event-stream");
}

/**
 * Wraps a runner generator into an SSE response:
 *   event: stage|result  data: <json>   — and `event: error` on failure.
 */
export function sseFromGenerator(gen: AsyncGenerator<RoundEvent>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      try {
        for await (const ev of gen) {
          if (ev.type === "stage") send("stage", { node: ev.node, label: ev.label });
          else send("result", ev.result);
        }
      } catch (err) {
        const { status, body } = toApiError(err);
        send("error", { status, ...body.error });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
