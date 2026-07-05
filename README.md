# GapFinder

An AI business analyst that interviews a founder about a vague product idea until the requirements are actually specific enough to build from, then writes the doc.

## The Problem

Client ideas start vague. "An app where freelancers track invoices" is a sentence, not a spec — it says nothing about who can see what, how payments work, what happens when something goes wrong. Someone has to turn that sentence into an actual requirements document, and today that someone is a business analyst spending hours in meetings dragging out details one at a time: who are the users, what's the data model, is there billing, what happens on errors.

The other current option pasting the same vague sentence into a generic AI tool and asking for an SRS document is worse, not better. The model doesn't push back on the gaps; it fills them in. Ask ChatGPT for a spec from one sentence and it will confidently invent an auth scheme, a pricing model, and a notification strategy you never asked for, formatted convincingly enough that it's easy to skim past the parts that were guessed rather than gathered. The document looks complete. It isn't. Wrong assumptions baked into a spec are more expensive to catch later than a missing spec is now a developer builds against the invented pricing model, and the mismatch surfaces during QA or, worse, after launch.

GapFinder is the middle path: an agent that asks the questions a BA would ask, tracks exactly what's actually been resolved versus assumed, and — critically — never silently guesses. If something stays unclear after the interview, it shows up labeled as an assumption in the final doc, not buried inside a user story as if it were fact.

## What This Does

1. **Paste an idea.** One or two sentences is enough, vague is the point. A "Use example idea" button is there for zero-typing testing.
2. **The agent asks one targeted question at a time.** Not "tell me more about your requirements" — a specific, scenario-based question grounded in your actual idea ("When a member cancels 30 minutes before class, what happens to their payment and the waitlist spot?"). It always targets whichever requirement category is least understood.
3. **A live checklist tracks progress on the right.** Seven categories, each badged `resolved` / `ambiguous` / `missing`, updating after every answer.
4. **After up to 10 rounds, or as soon as everything's resolved, it writes the doc.** User stories, acceptance criteria, and risks — plus an assumptions section that explicitly names every category that never got resolved, instead of quietly inventing an answer for it.

No sign-up, no setup. Everything after "paste an idea" happens automatically.

## How the Harness Is Designed

### The state graph

Four nodes. The state graph itself is a straight line per invocation, it is **not** a literal cycle in the LangGraph sense. There's no edge from "ask a question" back to "extract requirements" inside the compiled graph. Instead, each HTTP request runs the graph once, start to finish, and the *conversation* loop happens one level up: every answer triggers a fresh request that rehydrates state from Supabase and re-invokes the graph. Supabase is the checkpointer. This was a deliberate choice — LangGraph's native `interrupt()` + checkpointer pattern needs a persistent connection or a Postgres-backed saver to pause and resume a graph across requests, which is exactly the kind of long-lived infrastructure Vercel's serverless functions don't provide. Making each round stateless and durable in our own tables sidesteps that entirely.

```
Per HTTP request:

   START
     │
     ▼
┌─────────────────────┐
│ extract_requirements│  LLM, structured output — classifies all 7
│                     │  categories against the transcript so far
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    detect_gaps      │  pure code, zero LLM calls — deterministic
│                     │  resolved / ambiguous / missing mapping
└──────────┬──────────┘
           ▼
      ◇ any category unresolved
      ◇ AND round < 10 ?
      ╱             ╲
   yes                no
    │                  │
    ▼                  ▼
┌───────────────┐  ┌──────────────────────────┐
│plan_next_     │  │ generate_requirements_doc│
│question       │  │  LLM, structured output  │
│ LLM, targets   │  └────────────┬─────────────┘
│ the highest-   │               │
│ priority gap   │               │
└───────┬────────┘               │
        ▼                        ▼
       END                      END
  (question returned      (doc returned,
   to the user; next       session marked
   answer starts a          complete)
   fresh invocation)
```

```
Across the conversation (the outer loop):

  user idea ──▶ [invocation 1] ──▶ question 1 ──▶ user answers
                                                       │
                Supabase (sessions, requirement_state, ▼
                qa_history) persists everything    [invocation 2] ──▶ question 2 or doc
                between rounds — no in-memory              │
                state survives across requests            ▼
                                                        ... up to 10 rounds ...
```

### The 4 nodes

These are the graph's four processing steps — not LangChain tool-calling "tools" in the function-calling sense (nothing here uses `bindTools`); they're the discrete functions the harness runs each round.

| Node | What it does |
|---|---|
| **`extract_requirements`** | LLM call, forced into a Zod schema via `withStructuredOutput`. Reads the raw idea plus the full Q&A transcript and classifies each of the 7 categories as `explicit`, `vague`, or `absent`, with a value/summary for each. |
| **`detect_gaps`** | **Not an LLM call.** Plain deterministic code: `explicit` + a real value → `resolved`; `absent` → `missing`; anything else (including an `explicit` claim with no actual content) → `ambiguous`. This is the one place correctness can't drift with model mood — the same extraction always produces the same status. |
| **`plan_next_question`** | LLM call, but the *target category* isn't the model's choice — code picks it deterministically from a fixed priority order (core product shape first: `data_model → auth_roles → payments → integrations → notifications → security_compliance → non_functional`). The model's only job is phrasing one specific, scenario-based question about that category. |
| **`generate_requirements_doc`** | LLM call, structured output again (user stories, acceptance criteria, assumptions, risks). Runs after a code-level pass that guarantees every category still unresolved gets an explicit, labeled entry in `assumptions` — see below. |

### Why unresolved categories become labeled assumptions, not guesses

This is the actual point of the project, so it's enforced twice, not once:

1. **The prompt requires it.** `generate_requirements_doc`'s system prompt lists exactly which categories are resolved and which aren't, and instructs the model that every unresolved one must appear in `assumptions`, named explicitly, with a stated default — never folded silently into a user story or acceptance criterion as if it were settled.
2. **The code doesn't trust the prompt alone.** After the LLM responds, `agent/graph.ts` walks the actual unresolved list (computed from `requirement_state`, not from what the model claims) and appends a fallback assumption for any category the model's response failed to mention. If the model also mislabels something — occasionally it tags a genuinely *resolved* detail it's unsure about with the same "(unresolved)" marker — a second pass corrects that label so the document never contradicts the checklist sitting right next to it.

The result: the assumptions section is a reliable list of exactly what's still unknown, not a hopeful summary of what the model assumed you'd be fine with.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui | One deployable app, server and client code in the same project, no separate frontend host. |
| Persistence | Supabase (Postgres) | Real Postgres with Row Level Security built in — lets the "single session per browser, no real auth" model be enforced by the database itself, not just app code. |
| Agent harness | LangGraph.js (not Python) | The whole point of the architecture above: the graph runs as an ordinary import inside a Next.js API route. Python LangGraph would need its own server, which means a second deployment and CORS between two hosts — unnecessary for this scope. |
| LLM | Groq (`llama-3.3-70b-versatile`) | Free tier, fast inference, and supports the structured-output/function-calling the harness depends on for `extract_requirements` and `generate_requirements_doc`. |
| Hosting | Vercel | Zero-config Next.js deploys; because the agent runs inside API routes rather than a standalone server, one deploy is the whole system. |

## Architecture / Data Flow

```
Browser (React state machine, SSE client)
   │  fetch + ReadableStream (EventSource can't POST, so plain fetch reads the stream)
   ▼
Next.js API routes
   /api/session/start          POST  { raw_idea }
   /api/session/[id]/answer    POST  { answer }
   /api/session/[id]           GET   current state
   │
   ▼
agent/runner.ts   — thin, framework-free orchestration: creates/loads sessions,
                     saves answers, invokes the graph, wraps failures as typed errors
   │
   ▼
agent/graph.ts    — the LangGraph StateGraph described above
   │
   ▼
agent/db.ts       — Supabase client (service-role key, bypasses RLS)
   │
   ▼
Supabase Postgres
   sessions            — one row per browser session
   requirement_state   — 7 rows per session (one per category), auto-seeded by a trigger
   qa_history          — every question and answer, in order
   generated_docs      — the final doc, once
```

Every table has Row Level Security **enabled with zero policies** — the anon key can read and write nothing; every request goes through the service-role client server-side, and the browser's only credential is an unguessable session UUID kept in `localStorage`. There's no user login because there's no multi-tenant data to protect beyond "don't let one visitor read another's session."

The standalone Hono server in `agent/server.ts` (port 8123) is a local-dev-only convenience for exercising the agent independent of Next.js — it is not part of the deployed app. Vercel only ever runs the API routes above.

## Setup & Running Locally

**Prerequisites:** Node 22 (this project was built against 22.23.1 via nvm).

```bash
git clone https://github.com/hasnainsaleem18/GapFinder.git
cd GapFinder
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — the `service_role` secret key |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — free tier |

Then apply the schema once: Supabase dashboard → **SQL Editor** → paste [`supabase/migrations/00001_init.sql`](supabase/migrations/00001_init.sql) → **Run**.

```bash
npm run dev          # Next.js app on http://localhost:3000
```

Open `localhost:3000` for the app itself, or `localhost:3000/status` for a connectivity check (Next.js / Supabase / agent, each independently verified).

**Running the agent standalone** (optional — for testing the graph in isolation from the frontend):

```bash
npm run agent:dev    # Hono server on :8123 — GET /ping, POST /sessions,
                      # POST /sessions/:id/answer, GET /sessions/:id
```

## Live Demo

**[gap-finder-ruddy.vercel.app](https://gap-finder-ruddy.vercel.app)**

Works cold, from a fresh browser, with no setup — click **"Use example idea"** then **Start**. Everything from that point (the LLM calls, the database writes) happens against the live deployment's own Supabase project and Groq key; there's nothing to configure.

## What I'd Build Next

- **Multiple domain checklists.** Right now the 7 categories are a SaaS lens. An e-commerce idea, a mobile-first app, and an internal tool need different questions — the checklist should be selectable or inferred from the idea, not fixed.
- **Confidence scoring instead of binary resolved/ambiguous/missing.** A category resolved from one clear sentence and one resolved from a hedgy paragraph aren't equally solid; a confidence score would let a BA reviewing the output know where to double-check even after the interview "passed."
- **Direct export to Jira/Linear.** The doc is already structured (user stories, acceptance criteria as arrays) — turning that into actual tickets via each tool's API is a natural next step rather than copy-paste.
- **Multi-user async sessions.** Today it's one browser, one uninterrupted sitting. A real BA workflow often has the BA and the client both contributing at different times — that needs real auth and a session model beyond "whoever holds the localStorage key."
- **A paid or swappable LLM tier.** The free Groq tier has a shared daily token budget — fine for a demo, not fine for real usage volume. Worth abstracting the model call so a paid key (or a different provider) is a config change, not a code change.

## Known Limitations

These are intentional weekend-scope cuts, not oversights:

- **Single domain lens.** The 7 categories (auth & roles, data model, payments, notifications, security & compliance, integrations, non-functional) are SaaS-shaped and fixed in code. An e-commerce or hardware-adjacent idea gets asked SaaS questions regardless.
- **No real authentication.** "Single session per browser" is enforced by an unguessable session UUID in `localStorage`, not a login. Anyone with the URL to a specific session can view it; there's no account system to lock it down further, and that's fine for a single-sitting demo, not for production multi-user use.
- **Hard cap of 10 clarification rounds.** If categories still need real answers after 10 questions, the doc gets generated anyway with the rest labeled as assumptions rather than the interview continuing indefinitely. This keeps the demo bounded but means a genuinely complex or unresponsive-answer idea may end up with more assumptions than a real BA session would tolerate.
- **No in-app doc editing.** The generated requirements doc is a read-only view. If something in it needs correcting, the fix today is starting a new session with a better-specified idea, not editing the output directly.
- **Shared free-tier LLM quota.** Groq's free tier has a daily token budget shared across everyone hitting the live deployment. Heavy testing in a short window can temporarily exhaust it; a request that hits this returns a clear error rather than hanging, but it does mean the live demo can occasionally need a few minutes to recover rather than working every single time, back-to-back, without limit.
