# AI Requirement Clarification Agent

Weekend take-home scaffold: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui,
Supabase for persistence, and a LangGraph agent. Deploys to Vercel as a single app.

## Stack decisions

**LangGraph JS/TS (not Python).** The agent lives in [`agent/`](agent/) as a plain
TypeScript module and is exposed two ways:

- **Vercel / production:** `app/api/agent/*` route handlers import the graph directly —
  one repo, one build, one deploy. Python LangGraph can't run on Vercel and would force a
  second deployment (Railway/Render/LangGraph Platform) plus CORS/auth plumbing.
- **Local dev:** a standalone [Hono](https://hono.dev) server (`npm run agent:dev`,
  port 8123) runs the same graph as a separate process, keeping agent and frontend
  concerns separated.

Other reasons for JS over Python here: shared TypeScript types between agent state and
UI, and LangGraph JS has everything this project needs (StateGraph, checkpointers,
interrupts for human-in-the-loop clarification, streaming).

## Prerequisites

- Node 22 LTS (this machine uses nvm: `nvm use 22`)

## Quickstart

```bash
cp .env.example .env.local   # then fill in Supabase + LLM keys
npm install
npm run dev                  # Next.js on http://localhost:3000
npm run agent:dev            # (optional) standalone agent server on :8123
```

Open http://localhost:3000 — the app itself (idea intake → clarification chat →
requirements doc). Connectivity checks live at http://localhost:3000/status.

## Endpoints

| Endpoint | What it proves |
|---|---|
| `GET /api/health` | Next.js serves API routes; Supabase REST endpoint reachable with anon key |
| `GET /api/agent/ping` | LangGraph graph compiles and runs inside a Next.js route (the Vercel path) |
| `GET localhost:8123/ping` | Same graph served by the standalone agent process |

## Layout

```
app/                  Next.js App Router (pages + API routes)
  api/health/         Supabase connectivity check
  api/agent/ping/     Agent graph via Next.js (deploys to Vercel)
components/ui/        shadcn/ui components
lib/supabase/         Browser + server Supabase clients (@supabase/ssr)
agent/                LangGraph agent — self-contained, no Next.js imports
  graph.ts            The StateGraph (hello-world ping node for now)
  server.ts           Standalone Hono dev server (:8123)
```

## Database setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com) (any name/region;
   save the database password it asks for).
2. In the dashboard: **SQL Editor → New query**, paste the contents of
   [supabase/migrations/00001_init.sql](supabase/migrations/00001_init.sql), **Run**.
   (CLI alternative: `npx supabase link --project-ref <ref> && npx supabase db push`.)
3. **Project Settings → API**: copy the Project URL, `anon` key, and `service_role`
   key into `.env.local`.
4. Restart `npm run dev` — the Supabase card on the status page turns green
   (`schema missing` means step 2 hasn't run yet).

**Schema:** `sessions` (one per browser visit) → `requirement_state` (one row per
SaaS-lens category, auto-seeded to `missing` by a trigger on session insert) →
`qa_history` (clarification rounds) → `generated_docs` (jsonb arrays; latest row wins).

**Access model:** RLS is enabled deny-all — the anon key can't touch data. All queries
go through Next.js API routes using the service-role client in
[lib/supabase.ts](lib/supabase.ts) (guarded by `server-only`), scoped by the session
UUID the browser holds in a cookie. No real auth, by design, for this demo.

**Types:** [lib/database.types.ts](lib/database.types.ts) mirrors the schema. After
schema changes, regenerate with
`npx supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts`.

## Environment variables

See [.env.example](.env.example). The LLM key is provider-agnostic — uncomment
whichever you use and install the matching LangChain package
(`@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai`, or
`@langchain/groq`).

## Deploy

Push to GitHub → import into Vercel → set the env vars from `.env.example` in the
Vercel dashboard. No extra services needed; the agent runs in serverless functions.
