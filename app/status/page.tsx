"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CheckState = "loading" | "ok" | "warn" | "fail";

type Check = {
  state: CheckState;
  detail: string;
  label?: string; // overrides the default badge label for the state
};

const badgeFor: Record<
  CheckState,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  loading: { variant: "outline", label: "checking…" },
  ok: { variant: "default", label: "ok" },
  warn: { variant: "secondary", label: "not configured" },
  fail: { variant: "destructive", label: "unreachable" },
};

function StatusCard({ title, check }: { title: string; check: Check }) {
  const badge = badgeFor[check.state];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <Badge variant={badge.variant}>{check.label ?? badge.label}</Badge>
        </CardTitle>
        <CardDescription>{check.detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function StatusPage() {
  const [supabase, setSupabase] = useState<Check>({
    state: "loading",
    detail: "Checking Supabase connectivity…",
  });
  const [agent, setAgent] = useState<Check>({
    state: "loading",
    detail: "Pinging the LangGraph agent…",
  });

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.supabase === "ok") {
          setSupabase({ state: "ok", detail: "Connected — schema is in place." });
        } else if (data.supabase === "schema_missing") {
          setSupabase({
            state: "warn",
            label: "schema missing",
            detail:
              "Connected, but tables are missing — run supabase/migrations/00001_init.sql in the SQL editor.",
          });
        } else if (data.supabase === "not_configured") {
          setSupabase({
            state: "warn",
            detail:
              "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
          });
        } else {
          setSupabase({
            state: "fail",
            detail: "Env vars set, but Supabase did not respond.",
          });
        }
      })
      .catch(() => setSupabase({ state: "fail", detail: "Health endpoint failed." }));

    fetch("/api/agent/ping")
      .then((res) => res.json())
      .then((data) =>
        setAgent({
          state: "ok",
          detail: `${data.agent.message} at ${data.agent.timestamp}`,
        })
      )
      .catch(() => setAgent({ state: "fail", detail: "Agent graph did not respond." }));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connectivity checks for the Requirement Clarification Agent.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <StatusCard
          title="Next.js"
          check={{ state: "ok", detail: "App Router is rendering this page." }}
        />
        <StatusCard title="Supabase" check={supabase} />
        <StatusCard title="LangGraph agent" check={agent} />
      </div>

      <p className="text-muted-foreground text-xs">
        Endpoints: <code>/api/health</code> · <code>/api/agent/ping</code> ·
        standalone agent server via <code>npm run agent:dev</code> on{" "}
        <code>:8123</code>
      </p>
    </main>
  );
}
