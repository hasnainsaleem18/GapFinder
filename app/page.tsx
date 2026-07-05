"use client";

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
      <main className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm">
        Loading…
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
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">Requirement Clarification Agent</h1>
          <p className="text-muted-foreground max-w-xl truncate text-xs">
            {session.rawIdea}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={session.reset}>
          Start new session
        </Button>
      </header>

      <div className="mx-auto grid w-full max-w-5xl min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
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
