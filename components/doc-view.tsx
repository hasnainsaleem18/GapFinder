"use client";

import {
  BookOpen,
  FileCheck2,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { RequirementsDoc } from "@/agent/schemas";

function Section({
  title,
  description,
  items,
  emptyText,
  icon: Icon,
  tone,
  delay,
}: {
  title: string;
  description: string;
  items: unknown;
  emptyText: string;
  icon: typeof BookOpen;
  tone: "primary" | "amber" | "rose";
  delay: string;
}) {
  const list = Array.isArray(items) ? (items as string[]) : [];

  const chip = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
  }[tone];

  const marker = {
    primary: "bg-primary/60",
    amber: "bg-amber-500/70",
    rose: "bg-rose-500/70",
  }[tone];

  return (
    <Card
      className={cn(
        "gap-4 py-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
        delay
      )}
    >
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md",
              chip
            )}
          >
            <Icon className="size-4" />
          </span>
          {title}
          <Badge
            variant="outline"
            className="text-muted-foreground ml-auto text-[11px] tabular-nums"
          >
            {list.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          <ul className="space-y-2.5">
            {list.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span
                  className={cn(
                    "mt-[0.5625rem] size-1.5 shrink-0 rounded-full",
                    marker
                  )}
                />
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DocView({
  doc,
  onReset,
}: {
  doc: RequirementsDoc;
  onReset: () => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 pr-3 pb-4">
        <div className="flex items-start justify-between gap-4 animate-in fade-in duration-500">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <FileCheck2 className="size-4.5" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Requirements document
              </h2>
              <p className="text-muted-foreground text-sm">
                Generated from your idea and the clarification interview.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            New session
          </Button>
        </div>

        <Section
          title="User stories"
          description="As a [role], I want [goal], so that [reason]"
          items={doc.user_stories}
          emptyText="No user stories were generated."
          icon={BookOpen}
          tone="primary"
          delay="delay-0"
        />
        <Section
          title="Acceptance criteria"
          description="Given / When / Then — traceable to the stories"
          items={doc.acceptance_criteria}
          emptyText="No acceptance criteria were generated."
          icon={ListChecks}
          tone="primary"
          delay="delay-75"
        />
        <Section
          title="Assumptions"
          description="Includes every category that stayed unresolved — nothing is silently guessed"
          items={doc.assumptions}
          emptyText="No assumptions — every category was resolved in the interview."
          icon={TriangleAlert}
          tone="amber"
          delay="delay-150"
        />
        <Section
          title="Risks"
          description="Delivery and product risks specific to this idea"
          items={doc.risks}
          emptyText="No risks were identified."
          icon={ShieldAlert}
          tone="rose"
          delay="delay-200"
        />
      </div>
    </ScrollArea>
  );
}
