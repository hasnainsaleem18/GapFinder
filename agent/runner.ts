import { clarificationGraph, type ClarificationStateType } from "./graph";
import { createSession, loadSession, saveAnswer } from "./db";
import type { GapReport, RequirementsDoc } from "./schemas";

// ── Typed errors (HTTP mapping lives in lib/agent-api.ts) ────────────

export type RunnerErrorCode =
  | "invalid_input"
  | "unknown_session"
  | "session_complete"
  | "no_open_question"
  | "agent_failure";

export class RunnerError extends Error {
  constructor(
    public readonly code: RunnerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RunnerError";
  }
}

// ── Result shape ─────────────────────────────────────────────────────

export type RoundResult = {
  sessionId: string;
  round: number;
  gaps: GapReport;
} & (
  | { outcome: "question"; question: string }
  | { outcome: "doc"; doc: RequirementsDoc }
);

export type RoundEvent =
  | { type: "stage"; node: string; label: string }
  | { type: "result"; result: RoundResult };

const STAGE_LABELS: Record<string, string> = {
  extract_requirements: "Analyzing your idea",
  detect_gaps: "Checking requirement gaps",
  plan_next_question: "Writing the next question",
  generate_requirements_doc: "Generating your requirements document",
};

function toResult(state: ClarificationStateType): RoundResult {
  const base = {
    sessionId: state.sessionId,
    round: state.round,
    gaps: state.gaps!,
  };
  if (state.outcome === "doc") {
    return { ...base, outcome: "doc", doc: state.doc! };
  }
  return { ...base, outcome: "question", question: state.nextQuestion! };
}

type GraphInput = {
  sessionId: string;
  rawIdea: string;
  round: number;
  qaHistory: { round: number; question: string; answer: string | null }[];
};

/** Wrap LLM/graph failures (rate limits, timeouts, schema misses) uniformly. */
function asAgentFailure(err: unknown): never {
  if (err instanceof RunnerError) throw err;
  const detail = err instanceof Error ? err.message : String(err);
  throw new RunnerError(
    "agent_failure",
    `The agent could not complete this step (${detail}). Please try again.`
  );
}

async function invokeGraph(input: GraphInput): Promise<RoundResult> {
  try {
    const state = await clarificationGraph.invoke(input);
    return toResult(state as ClarificationStateType);
  } catch (err) {
    asAgentFailure(err);
  }
}

/**
 * Streaming variant: yields a stage event as each node starts producing
 * output, then the final result. streamMode "updates" gives one chunk per
 * node keyed by node name; we merge them to rebuild the final state.
 */
async function* streamGraph(input: GraphInput): AsyncGenerator<RoundEvent> {
  const merged: Record<string, unknown> = { ...input };
  try {
    const stream = await clarificationGraph.stream(input, {
      streamMode: "updates",
    });
    for await (const chunk of stream) {
      for (const [node, update] of Object.entries(
        chunk as Record<string, Record<string, unknown>>
      )) {
        Object.assign(merged, update);
        yield { type: "stage", node, label: STAGE_LABELS[node] ?? node };
      }
    }
  } catch (err) {
    asAgentFailure(err);
  }
  yield { type: "result", result: toResult(merged as ClarificationStateType) };
}

// ── Input preparation (shared by invoke + stream paths) ──────────────

async function prepareStart(rawIdea: string): Promise<GraphInput> {
  const idea = rawIdea.trim();
  if (!idea) throw new RunnerError("invalid_input", "raw_idea must not be empty");

  const sessionId = await createSession(idea);
  return { sessionId, rawIdea: idea, round: 0, qaHistory: [] };
}

async function prepareAnswer(sessionId: string, answer: string): Promise<GraphInput> {
  const text = answer.trim();
  if (!text) throw new RunnerError("invalid_input", "answer must not be empty");

  const snapshot = await loadSession(sessionId);
  if (!snapshot) {
    throw new RunnerError("unknown_session", `unknown session: ${sessionId}`);
  }
  if (snapshot.status === "complete") {
    throw new RunnerError("session_complete", "session is already complete");
  }

  try {
    await saveAnswer(sessionId, text);
  } catch (err) {
    if (err instanceof Error && err.message.includes("no open question")) {
      // Retry case: the previous request saved this answer but the LLM step
      // failed afterwards. Re-running the graph is the correct recovery.
      const last = snapshot.qaHistory[snapshot.qaHistory.length - 1];
      const isRetry = last?.answer === text;
      if (!isRetry) {
        throw new RunnerError(
          "no_open_question",
          "no open question awaiting an answer"
        );
      }
    } else {
      throw err;
    }
  }

  const fresh = await loadSession(sessionId);
  return {
    sessionId,
    rawIdea: fresh!.rawIdea,
    round: fresh!.qaHistory.length, // questions asked so far
    qaHistory: fresh!.qaHistory.filter((e) => e.answer !== null),
  };
}

// ── Public API ───────────────────────────────────────────────────────

/** Create a session from a raw idea and run the first clarification round. */
export async function startSession(rawIdea: string): Promise<RoundResult> {
  return invokeGraph(await prepareStart(rawIdea));
}

/** Record the answer, rehydrate from Supabase, re-enter the graph. */
export async function submitAnswer(
  sessionId: string,
  answer: string
): Promise<RoundResult> {
  return invokeGraph(await prepareAnswer(sessionId, answer));
}

/** Streaming versions — stage events, then the result. */
export async function* streamStart(rawIdea: string): AsyncGenerator<RoundEvent> {
  yield* streamGraph(await prepareStart(rawIdea));
}

export async function* streamAnswer(
  sessionId: string,
  answer: string
): AsyncGenerator<RoundEvent> {
  yield* streamGraph(await prepareAnswer(sessionId, answer));
}

/** Debug/UI helper: current persisted state of a session. */
export { loadSession } from "./db";
