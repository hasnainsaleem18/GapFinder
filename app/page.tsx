"use client";

import { Loader2, RotateCcw, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdeaForm } from "@/components/idea-form";
import { ChatPanel } from "@/components/chat-panel";
import { ChecklistPanel } from "@/components/checklist-panel";
import { DocView } from "@/components/doc-view";
import { useClarificationSession } from "@/lib/use-session";

export default function Home() {
  const session = useClarificationSession();

  if (session.phase === "restoring") {
    return (
      <main className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Restoring your session…
      </main>
    );
  }

  if (session.phase === "idle") {
    return (
      <IdeaForm
        onStart={session.start}
        error={session.error}
        onRetry={session.retry}
        canRetry={session.canRetry}
        initialIdea={session.rawIdea}
      />
    );
  }

  return (
    <div className="bg-muted/40 flex h-dvh flex-col">
      <header className="bg-background flex items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
            <ScanSearch className="size-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-sm font-semibold tracking-tight">
              GapFinder
            </h1>
            <p className="text-muted-foreground max-w-lg truncate text-xs">
              {session.rawIdea}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={session.reset}>
          <RotateCcw className="size-3.5" />
          New session
        </Button>
      </header>

      <div className="mx-auto grid w-full max-w-5xl min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col">
          {session.phase === "complete" && session.doc ? (
            <DocView doc={session.doc} onReset={session.reset} />
          ) : (
            <ChatPanel
              rawIdea={session.rawIdea}
              thread={session.thread}
              phase={session.phase}
              stage={session.stage}
              error={session.error}
              canRetry={session.canRetry}
              onAnswer={session.answer}
              onRetry={session.retry}
            />
          )}
        </div>
        <div className="min-h-0 overflow-y-auto">
          <ChecklistPanel gaps={session.gaps} />
        </div>
      </div>
    </div>
  );
}
