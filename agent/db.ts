import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { Category, GapReport, RequirementsDoc } from "./schemas";

// supabase access for the agent, service key straight up. can't reuse
// lib/supabase.ts here — its "server-only" import blows up under plain tsx,
// and the standalone dev server runs this exact code.
let client: SupabaseClient<Database> | null = null;

function db(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type QaEntry = { round: number; question: string; answer: string | null };

export type SessionSnapshot = {
  sessionId: string;
  rawIdea: string;
  status: Database["public"]["Enums"]["session_status"];
  qaHistory: QaEntry[];
  gaps: GapReport;
};

export async function createSession(rawIdea: string): Promise<string> {
  const { data, error } = await db()
    .from("sessions")
    .insert({ raw_idea: rawIdea })
    .select("id")
    .single();
  if (error) throw new Error(`createSession failed: ${error.message}`);
  return data.id;
}

export async function loadSession(sessionId: string): Promise<SessionSnapshot | null> {
  const { data: session, error: e1 } = await db()
    .from("sessions")
    .select("id, raw_idea, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (e1) throw new Error(`loadSession failed: ${e1.message}`);
  if (!session) return null;

  const [{ data: qa, error: e2 }, { data: rs, error: e3 }] = await Promise.all([
    db()
      .from("qa_history")
      .select("round, question, answer")
      .eq("session_id", sessionId)
      .order("round", { ascending: true }),
    db()
      .from("requirement_state")
      .select("category, status, resolved_value")
      .eq("session_id", sessionId),
  ]);
  if (e2) throw new Error(`loadSession qa failed: ${e2.message}`);
  if (e3) throw new Error(`loadSession state failed: ${e3.message}`);

  const gaps = Object.fromEntries(
    (rs ?? []).map((r) => [
      r.category,
      { status: r.status, resolvedValue: r.resolved_value },
    ])
  ) as GapReport;

  return {
    sessionId: session.id,
    rawIdea: session.raw_idea,
    status: session.status,
    qaHistory: qa ?? [],
    gaps,
  };
}

export async function saveGaps(sessionId: string, gaps: GapReport): Promise<void> {
  const rows = (Object.entries(gaps) as [Category, GapReport[Category]][]).map(
    ([category, gap]) => ({
      session_id: sessionId,
      category,
      status: gap.status,
      resolved_value: gap.resolvedValue,
    })
  );
  const { error } = await db()
    .from("requirement_state")
    .upsert(rows, { onConflict: "session_id,category" });
  if (error) throw new Error(`saveGaps failed: ${error.message}`);
}

export async function saveQuestion(
  sessionId: string,
  round: number,
  question: string
): Promise<void> {
  const { error } = await db()
    .from("qa_history")
    .insert({ session_id: sessionId, round, question });
  if (error) throw new Error(`saveQuestion failed: ${error.message}`);
}

// pins the answer onto the newest open question. throws if there isn't one —
// the runner turns that into a proper 409 upstream.
export async function saveAnswer(sessionId: string, answer: string): Promise<QaEntry> {
  const { data: open, error: e1 } = await db()
    .from("qa_history")
    .select("id, round, question")
    .eq("session_id", sessionId)
    .is("answer", null)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(`saveAnswer lookup failed: ${e1.message}`);
  if (!open) throw new Error("no open question awaiting an answer");

  const { error: e2 } = await db()
    .from("qa_history")
    .update({ answer })
    .eq("id", open.id);
  if (e2) throw new Error(`saveAnswer update failed: ${e2.message}`);

  return { round: open.round, question: open.question, answer };
}

export async function loadLatestDoc(
  sessionId: string
): Promise<RequirementsDoc | null> {
  const { data, error } = await db()
    .from("generated_docs")
    .select("user_stories, acceptance_criteria, assumptions, risks")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`loadLatestDoc failed: ${error.message}`);
  return (data as RequirementsDoc | null) ?? null;
}

export async function saveDoc(
  sessionId: string,
  doc: RequirementsDoc
): Promise<void> {
  const { error: e1 } = await db().from("generated_docs").insert({
    session_id: sessionId,
    user_stories: doc.user_stories,
    acceptance_criteria: doc.acceptance_criteria,
    assumptions: doc.assumptions,
    risks: doc.risks,
  });
  if (e1) throw new Error(`saveDoc failed: ${e1.message}`);

  const { error: e2 } = await db()
    .from("sessions")
    .update({ status: "complete" })
    .eq("id", sessionId);
  if (e2) throw new Error(`saveDoc status update failed: ${e2.message}`);
}
