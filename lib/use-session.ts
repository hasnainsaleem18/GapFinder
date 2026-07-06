"use client";

import { useCallback, useEffect, useState } from "react";
import type { GapReport, RequirementsDoc } from "@/agent/schemas";
import type { RoundResult } from "@/agent/runner";
import {
  ApiError,
  getSession,
  startSession,
  submitAnswer,
} from "@/lib/session-client";

const STORAGE_KEY = "clarify_session_id";

export type ThreadItem = { round: number; question: string; answer: string | null };

export type Phase = "idle" | "restoring" | "thinking" | "awaiting_answer" | "complete";

type PendingAction =
  | { kind: "start"; rawIdea: string }
  | { kind: "answer"; text: string };

export type SessionUiState = {
  phase: Phase;
  sessionId: string | null;
  rawIdea: string;
  thread: ThreadItem[];
  gaps: GapReport | null;
  doc: RequirementsDoc | null;
  stage: string | null;
  error: string | null;
};

const INITIAL: SessionUiState = {
  phase: "restoring",
  sessionId: null,
  rawIdea: "",
  thread: [],
  gaps: null,
  doc: null,
  stage: null,
  error: null,
};

export function useClarificationSession() {
  const [state, setState] = useState<SessionUiState>(INITIAL);
  const [pending, setPending] = useState<PendingAction | null>(null);

  // restore whatever session this browser had going (one session per browser)
  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!id) {
      setState((s) => ({ ...s, phase: "idle" }));
      return;
    }
    getSession(id)
      .then(async (snap) => {
        const last = snap.qaHistory[snap.qaHistory.length - 1];
        // ugly edge case: answer got saved server-side but the llm died
        // before producing the next question. session still says "gathering",
        // last question already answered, nothing open — without this branch
        // the composer sits disabled saying "waiting for the agent…" forever
        // after a refresh. resubmitting the same answer text lets the
        // backend's retry matching (runner.ts prepareAnswer) pick the round
        // back up like nothing happened.
        const interrupted =
          snap.status === "gathering" && !!last && last.answer !== null;

        if (!interrupted) {
          setState({
            phase: snap.status === "complete" ? "complete" : "awaiting_answer",
            sessionId: snap.sessionId,
            rawIdea: snap.rawIdea,
            thread: snap.qaHistory,
            gaps: snap.gaps,
            doc: snap.doc,
            stage: null,
            error: null,
          });
          return;
        }

        setState({
          phase: "thinking",
          sessionId: snap.sessionId,
          rawIdea: snap.rawIdea,
          thread: snap.qaHistory,
          gaps: snap.gaps,
          doc: snap.doc,
          stage: null,
          error: null,
        });
        setPending({ kind: "answer", text: last.answer! });
        try {
          const result = await submitAnswer(snap.sessionId, last.answer!, (label) =>
            setState((s) => ({ ...s, stage: label }))
          );
          setPending(null);
          applyResult(result);
        } catch (err) {
          fail(err);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setState((s) => ({ ...s, phase: "idle" }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyResult = useCallback((result: RoundResult) => {
    localStorage.setItem(STORAGE_KEY, result.sessionId);
    setState((s) => {
      if (result.outcome === "doc") {
        return {
          ...s,
          phase: "complete",
          sessionId: result.sessionId,
          gaps: result.gaps,
          doc: result.doc,
          stage: null,
          error: null,
        };
      }
      return {
        ...s,
        phase: "awaiting_answer",
        sessionId: result.sessionId,
        gaps: result.gaps,
        thread: [
          ...s.thread,
          { round: result.round, question: result.question, answer: null },
        ],
        stage: null,
        error: null,
      };
    });
  }, []);

  const fail = useCallback((err: unknown) => {
    const message =
      err instanceof ApiError
        ? err.message
        : "Something went wrong. Please try again.";
    setState((s) => ({
      ...s,
      // always land somewhere the user can act from — never a dead phase
      phase: s.sessionId ? "awaiting_answer" : "idle",
      stage: null,
      error: message,
    }));
  }, []);

  const onStage = useCallback(
    (label: string) => setState((s) => ({ ...s, stage: label })),
    []
  );

  const run = useCallback(
    async (action: PendingAction) => {
      setPending(action);
      setState((s) => ({ ...s, phase: "thinking", stage: null, error: null }));
      try {
        const result =
          action.kind === "start"
            ? await startSession(action.rawIdea, onStage)
            : await submitAnswer(state.sessionId!, action.text, onStage);
        setPending(null);
        applyResult(result);
      } catch (err) {
        fail(err);
      }
    },
    [applyResult, fail, onStage, state.sessionId]
  );

  const start = useCallback(
    (rawIdea: string) => {
      setState((s) => ({ ...s, rawIdea }));
      void run({ kind: "start", rawIdea });
    },
    [run]
  );

  const answer = useCallback(
    (text: string) => {
      // optimistically pin the answer onto the open question so it renders
      // immediately instead of waiting for the round-trip
      setState((s) => ({
        ...s,
        thread: s.thread.map((t, i) =>
          i === s.thread.length - 1 ? { ...t, answer: text } : t
        ),
      }));
      void run({ kind: "answer", text });
    },
    [run]
  );

  const retry = useCallback(() => {
    if (pending) void run(pending);
  }, [pending, run]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPending(null);
    setState({ ...INITIAL, phase: "idle" });
  }, []);

  return { ...state, start, answer, retry, reset, canRetry: pending !== null };
}
