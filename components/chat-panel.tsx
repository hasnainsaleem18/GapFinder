"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch, SendHorizontal, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ThreadItem, Phase } from "@/lib/use-session";
import { MAX_ROUNDS } from "@/agent/schemas";

function AgentAvatar() {
  return (
    <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
      <ScanSearch className="size-3.5" strokeWidth={2.25} />
    </span>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex animate-in fade-in slide-in-from-bottom-1 duration-300",
        side === "right" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          side === "right"
            ? "bg-primary text-primary-foreground rounded-lg rounded-br-sm"
            : "bg-muted rounded-lg rounded-tl-sm"
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
    <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0 shadow-sm">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <Bubble side="right">{rawIdea}</Bubble>

          {thread.map((item) => (
            <div key={item.round} className="space-y-4">
              <div className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <AgentAvatar />
                <div className="min-w-0 space-y-1">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Question {item.round} of {MAX_ROUNDS}
                  </p>
                  <div className="bg-muted max-w-full rounded-lg rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {item.question}
                  </div>
                </div>
              </div>
              {item.answer !== null && <Bubble side="right">{item.answer}</Bubble>}
            </div>
          ))}

          {thinking && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
              <AgentAvatar />
              <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg rounded-tl-sm px-3.5 py-2.5 text-sm">
                <Loader2 className="size-3.5 animate-spin" />
                {stage ?? "Thinking"}…
              </div>
            </div>
          )}

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

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="bg-muted/30 flex items-end gap-2 border-t p-3">
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
          className="bg-background min-h-0 resize-none"
        />
        <Button onClick={send} disabled={!canSend} aria-label="Send answer">
          <SendHorizontal className="size-4" />
          Send
        </Button>
      </div>
    </Card>
  );
}
