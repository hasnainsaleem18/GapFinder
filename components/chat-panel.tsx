"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ThreadItem, Phase } from "@/lib/use-session";
import { MAX_ROUNDS } from "@/agent/schemas";

function Bubble({
  side,
  children,
  muted,
}: {
  side: "left" | "right";
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          side === "right"
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
          muted && "text-muted-foreground animate-pulse"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatPanel({
  rawIdea,
  thread,
  phase,
  stage,
  error,
  canRetry,
  onAnswer,
  onRetry,
}: {
  rawIdea: string;
  thread: ThreadItem[];
  phase: Phase;
  stage: string | null;
  error: string | null;
  canRetry: boolean;
  onAnswer: (text: string) => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, stage, error, phase]);

  const thinking = phase === "thinking";
  const openQuestion = thread.length > 0 && thread[thread.length - 1].answer === null;
  const canSend = phase === "awaiting_answer" && openQuestion && draft.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onAnswer(draft.trim());
    setDraft("");
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          <Bubble side="right">{rawIdea}</Bubble>

          {thread.map((item) => (
            <div key={item.round} className="space-y-3">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  Question {item.round} of {MAX_ROUNDS}
                </p>
                <Bubble side="left">{item.question}</Bubble>
              </div>
              {item.answer !== null && <Bubble side="right">{item.answer}</Bubble>}
            </div>
          ))}

          {thinking && <Bubble side="left" muted>{stage ?? "Thinking"}…</Bubble>}

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

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            thinking
              ? "The agent is thinking…"
              : openQuestion
                ? "Type your answer (Enter to send)"
                : "Waiting for the agent…"
          }
          rows={2}
          disabled={phase !== "awaiting_answer" || !openQuestion}
          className="min-h-0 resize-none"
        />
        <Button onClick={send} disabled={!canSend}>
          Send
        </Button>
      </div>
    </Card>
  );
}
