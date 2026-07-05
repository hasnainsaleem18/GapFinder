"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EXAMPLE_IDEA =
  "A marketplace where local chefs sell home-cooked meals to nearby customers";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Requirement Clarification Agent
        </h1>
        <p className="text-muted-foreground text-sm">
          Describe your product idea. The agent asks the questions a business
          analyst would, then writes the requirements document.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your idea</CardTitle>
          <CardDescription>
            One or two sentences is enough — vague is fine, that&apos;s the point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. an app where freelancers track invoices"
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onStart(idea)} disabled={!idea.trim()}>
              Start
            </Button>
            <Button variant="outline" onClick={() => setIdea(EXAMPLE_IDEA)}>
              Use example idea
            </Button>
          </div>
          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span>{error}</span>
              {canRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
