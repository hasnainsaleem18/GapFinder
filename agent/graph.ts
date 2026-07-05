import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { getModel } from "./model";
import { saveGaps, saveQuestion, saveDoc, type QaEntry } from "./db";
import {
  CATEGORIES,
  CATEGORY_PRIORITY,
  ExtractionSchema,
  DocSchema,
  type Category,
  type Extraction,
  type GapReport,
  type RequirementsDoc,
} from "./schemas";
import {
  CATEGORY_LABELS,
  EXTRACTION_SYSTEM,
  questionSystem,
  docSystem,
} from "./prompts";

export const MAX_ROUNDS = 4;

// ── State schema ─────────────────────────────────────────────────────

const ClarificationState = Annotation.Root({
  sessionId: Annotation<string>,
  rawIdea: Annotation<string>,
  /** Questions asked so far (0..MAX_ROUNDS). */
  round: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  qaHistory: Annotation<QaEntry[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  extraction: Annotation<Extraction | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  gaps: Annotation<GapReport | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  nextQuestion: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  doc: Annotation<RequirementsDoc | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** What this invocation produced — the frontend switches on this. */
  outcome: Annotation<"question" | "doc" | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type ClarificationStateType = typeof ClarificationState.State;

// ── Shared prompt helpers ────────────────────────────────────────────

function transcript(state: ClarificationStateType): string {
  const qa = state.qaHistory
    .filter((e) => e.answer !== null)
    .map((e) => `Q${e.round}: ${e.question}\nA${e.round}: ${e.answer}`)
    .join("\n\n");
  return `PRODUCT IDEA:\n${state.rawIdea}${qa ? `\n\nCLARIFICATION Q&A:\n${qa}` : ""}`;
}

function unresolvedOf(gaps: GapReport): Category[] {
  // Strict category priority: an ambiguous core category (e.g. data_model)
  // outranks a missing peripheral one — with only MAX_ROUNDS questions,
  // clarify the core product first. Status shapes HOW the question is
  // asked (see questionSystem), not the order.
  return CATEGORY_PRIORITY.filter((c) => gaps[c].status !== "resolved");
}

// ── Node 1: extract_requirements (LLM, structured output) ────────────

async function extractRequirements(
  state: ClarificationStateType
): Promise<Partial<ClarificationStateType>> {
  const extractor = getModel().withStructuredOutput(ExtractionSchema, {
    name: "record_requirement_extraction",
  });

  const extraction = await extractor.invoke([
    ["system", EXTRACTION_SYSTEM],
    ["human", transcript(state)],
  ]);

  return { extraction };
}

// ── Node 2: detect_gaps (pure logic — NO LLM call) ───────────────────

async function detectGaps(
  state: ClarificationStateType
): Promise<Partial<ClarificationStateType>> {
  const extraction = state.extraction;
  if (!extraction) throw new Error("detect_gaps: extraction missing from state");

  const gaps = Object.fromEntries(
    CATEGORIES.map((category) => {
      const { captured, value } = extraction[category];
      const hasValue = typeof value === "string" && value.trim().length > 0;
      // Deterministic mapping; an "explicit" without substance is downgraded.
      const status =
        captured === "explicit" && hasValue
          ? "resolved"
          : captured === "absent"
            ? "missing"
            : "ambiguous";
      return [
        category,
        { status, resolvedValue: status === "resolved" ? value : null },
      ];
    })
  ) as GapReport;

  await saveGaps(state.sessionId, gaps); // persist after this node

  return { gaps };
}

// ── Conditional edge ─────────────────────────────────────────────────

function routeAfterGaps(
  state: ClarificationStateType
): "plan_next_question" | "generate_requirements_doc" {
  const unresolved = state.gaps ? unresolvedOf(state.gaps) : [];
  return unresolved.length > 0 && state.round < MAX_ROUNDS
    ? "plan_next_question"
    : "generate_requirements_doc";
}

// ── Node 3: plan_next_question (LLM; target chosen deterministically) ─

async function planNextQuestion(
  state: ClarificationStateType
): Promise<Partial<ClarificationStateType>> {
  if (!state.gaps) throw new Error("plan_next_question: gaps missing from state");

  const target = unresolvedOf(state.gaps)[0];
  const targetGap = state.gaps[target];
  const round = state.round + 1;

  const alreadyAsked = state.qaHistory.map((e) => `- ${e.question}`).join("\n");

  const res = await getModel().invoke([
    ["system", questionSystem(CATEGORY_LABELS[target], targetGap.status, alreadyAsked)],
    ["human", transcript(state)],
  ]);

  const question = String(res.content).trim();
  await saveQuestion(state.sessionId, round, question); // persist after this node

  return { nextQuestion: question, round, outcome: "question" };
}

// ── Node 4: generate_requirements_doc (LLM, structured output) ───────

async function generateRequirementsDoc(
  state: ClarificationStateType
): Promise<Partial<ClarificationStateType>> {
  if (!state.gaps) throw new Error("generate_doc: gaps missing from state");

  const gaps = state.gaps;
  const resolved = CATEGORIES.filter((c) => gaps[c].status === "resolved");
  const unresolved = CATEGORIES.filter((c) => gaps[c].status !== "resolved");

  const resolvedBlock = resolved
    .map((c) => `- ${CATEGORY_LABELS[c]}: ${gaps[c].resolvedValue}`)
    .join("\n");
  const unresolvedBlock = unresolved
    .map((c) => `- ${c} (${CATEGORY_LABELS[c]}) — ${gaps[c].status}`)
    .join("\n");

  const generator = getModel().withStructuredOutput(DocSchema, {
    name: "record_requirements_doc",
  });

  const doc = await generator.invoke([
    ["system", docSystem(resolvedBlock, unresolvedBlock)],
    ["human", transcript(state)],
  ]);

  // Code-level correction: the model occasionally tags a genuinely RESOLVED
  // category as "(unresolved)" when it's flagging some interpretive detail
  // it's unsure about. That contradicts requirement_state and misleads the
  // reader, so fix the label rather than trust the model's tagging.
  const mislabelPattern = (c: Category) =>
    new RegExp(`^\\s*(${c}|${c.replace(/_/g, " ")})\\s*\\(unresolved\\)`, "i");
  const correctedAssumptions = doc.assumptions.map((a) => {
    const falselyUnresolved = resolved.find((c) => mislabelPattern(c).test(a.trim()));
    return falselyUnresolved ? a.replace(/\(unresolved\)/i, "(note)") : a;
  });

  // Code-level guarantee of "never silently guess": any unresolved category
  // the model failed to mention in assumptions gets an explicit entry.
  const assumptions = [...correctedAssumptions];
  for (const c of unresolved) {
    const mentioned = assumptions.some((a) =>
      a.toLowerCase().includes(c.replace(/_/g, " ")) || a.toLowerCase().includes(c)
    );
    if (!mentioned) {
      assumptions.push(
        `${c} (${gaps[c].status}): not clarified during the interview — no requirements defined; must be revisited before build.`
      );
    }
  }
  const finalDoc: RequirementsDoc = { ...doc, assumptions };

  await saveDoc(state.sessionId, finalDoc); // persist after this node (+ status=complete)

  return { doc: finalDoc, outcome: "doc" };
}

// ── Graph definition ─────────────────────────────────────────────────

export const clarificationGraph = new StateGraph(ClarificationState)
  .addNode("extract_requirements", extractRequirements)
  .addNode("detect_gaps", detectGaps)
  .addNode("plan_next_question", planNextQuestion)
  .addNode("generate_requirements_doc", generateRequirementsDoc)
  .addEdge(START, "extract_requirements")
  .addEdge("extract_requirements", "detect_gaps")
  .addConditionalEdges("detect_gaps", routeAfterGaps, [
    "plan_next_question",
    "generate_requirements_doc",
  ])
  // Both terminal for this invocation: a question returns to the user
  // (the answer re-enters the graph on the next request — DB is the
  // checkpointer), a doc completes the session.
  .addEdge("plan_next_question", END)
  .addEdge("generate_requirements_doc", END)
  .compile();

// ── Hello-world ping (kept for /api/agent/ping and the status page) ──

const PingState = Annotation.Root({
  message: Annotation<string>,
  timestamp: Annotation<string>,
});

export type AgentStateType = typeof PingState.State;

function ping(): Partial<AgentStateType> {
  return {
    message: "pong from LangGraph",
    timestamp: new Date().toISOString(),
  };
}

export const graph = new StateGraph(PingState)
  .addNode("ping", ping)
  .addEdge(START, "ping")
  .addEdge("ping", END)
  .compile();

export async function runPing(): Promise<AgentStateType> {
  return graph.invoke({});
}
