"use client";

import { useState } from "react";
import { ArrowRight, ScanSearch, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const EXAMPLE_IDEA =
  "A marketplace where local chefs sell home-cooked meals to nearby customers";

const CHECK_AREAS = [
  "Data model",
  "Auth & roles",
  "Payments",
  "Integrations",
  "Notifications",
  "Security & compliance",
  "Non-functional",
];

export function IdeaForm({
  onStart,
  error,
  onRetry,
  canRetry,
  initialIdea = "",
}: {
  onStart: (idea: string) => void;
  error: string | null;
  onRetry: () => void;
  canRetry: boolean;
  initialIdea?: string;
}) {
  const [idea, setIdea] = useState(initialIdea);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Quiet backdrop: a single soft wash of the accent, nothing more. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/[0.07] to-transparent"
      />

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        {/* Brand */}
        <div className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <ScanSearch className="size-4.5" strokeWidth={2.25} />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">
            GapFinder
          </span>
        </div>

        {/* Hero */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="font-heading text-4xl font-semibold leading-[1.12] tracking-tight text-balance sm:text-[2.75rem]">
            Turn a vague idea into a build-ready spec.
          </h1>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            GapFinder interviews you the way a senior business analyst would —
            one pointed question at a time — tracking a live requirements
            checklist until nothing important is left unsaid. What stays
            unclear is labeled an assumption, never silently guessed.
          </p>
        </div>

        {/* Input */}
        <Card className="py-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardContent className="space-y-4 px-5">
            <div className="space-y-2">
              <label
                htmlFor="idea"
                className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
              >
                Your product idea
              </label>
              <Textarea
                id="idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. an app where freelancers track invoices"
                rows={4}
                className="resize-none text-base leading-relaxed"
              />
              <p className="text-muted-foreground text-xs">
                One or two sentences is enough — vague is fine, that&apos;s the
                point.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                size="lg"
                onClick={() => onStart(idea)}
                disabled={!idea.trim()}
              >
                Start the interview
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setIdea(EXAMPLE_IDEA)}
              >
                <Sparkles className="size-4" />
                Use example idea
              </Button>
            </div>

            {error && (
              <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm animate-in fade-in duration-300">
                <span className="flex items-center gap-2">
                  <TriangleAlert className="size-4 shrink-0" />
                  {error}
                </span>
                {canRetry && (
                  <Button size="sm" variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* What gets checked */}
        <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Seven requirement areas, checked every round
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CHECK_AREAS.map((area) => (
              <span
                key={area}
                className="border-border/80 text-muted-foreground rounded-full border bg-card px-2.5 py-1 text-xs"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
