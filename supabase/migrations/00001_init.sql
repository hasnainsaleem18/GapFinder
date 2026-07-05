-- ============================================================
-- Requirement Clarification Agent — initial schema
--
-- Access model (demo, no real auth):
--   * RLS is ENABLED on every table with ZERO policies, so the
--     anon and authenticated roles can read/write nothing.
--   * All data access goes through Next.js API routes using the
--     service-role key, which bypasses RLS.
--   * "Single session per browser" is enforced at the app layer:
--     the browser holds only its session UUID (cookie); every
--     server query is scoped by that unguessable ID.
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type public.session_status as enum ('gathering', 'complete');

create type public.requirement_status as enum ('resolved', 'ambiguous', 'missing');

-- SaaS domain lens: the fixed set of requirement categories the
-- agent must drive to "resolved" before generating docs.
create type public.requirement_category as enum (
  'auth_roles',
  'data_model',
  'payments',
  'notifications',
  'security_compliance',
  'integrations',
  'non_functional'
);

-- ── Tables ───────────────────────────────────────────────────

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw_idea   text not null,
  status     public.session_status not null default 'gathering'
);

-- One row per (session, category); resolved_value stays null
-- until the category reaches 'resolved'.
create table public.requirement_state (
  session_id     uuid not null references public.sessions (id) on delete cascade,
  category       public.requirement_category not null,
  status         public.requirement_status not null default 'missing',
  resolved_value text,
  primary key (session_id, category)
);

-- Clarification loop transcript. answer is null while a question
-- is awaiting the user's reply. Surrogate PK so a single round
-- may contain multiple questions.
create table public.qa_history (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  round      integer not null,
  question   text not null,
  answer     text
);

create index qa_history_session_round_idx
  on public.qa_history (session_id, round);

-- Final output. Content columns are jsonb arrays (lists of
-- strings/objects). Multiple rows per session are allowed so
-- regeneration keeps history; the latest row wins by created_at.
create table public.generated_docs (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.sessions (id) on delete cascade,
  user_stories        jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  assumptions         jsonb not null default '[]'::jsonb,
  risks               jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);

create index generated_docs_session_idx
  on public.generated_docs (session_id, created_at desc);

-- ── Seed trigger ─────────────────────────────────────────────
-- Every new session starts with all 7 categories as 'missing',
-- so the category lens is complete by construction and agent
-- code never has to remember to seed.

create or replace function public.seed_requirement_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.requirement_state (session_id, category)
  select new.id, c
  from unnest(enum_range(null::public.requirement_category)) as c;
  return new;
end;
$$;

create trigger sessions_seed_requirement_state
  after insert on public.sessions
  for each row
  execute function public.seed_requirement_state();

-- ── Row Level Security ───────────────────────────────────────
-- Enabled with no policies = deny-all for anon/authenticated.
-- The service-role key (server-side only) bypasses RLS.

alter table public.sessions          enable row level security;
alter table public.requirement_state enable row level security;
alter table public.qa_history        enable row level security;
alter table public.generated_docs    enable row level security;
