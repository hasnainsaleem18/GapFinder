"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RequirementsDoc } from "@/agent/schemas";

function Section({
  title,
  description,
  items,
  emptyText,
}: {
  title: string;
  description: string;
  items: unknown;
  emptyText: string;
}) {
  const list = Array.isArray(items) ? (items as string[]) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {list.map((item, i) => (
              <li key={i}>{item}</li>
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Requirements document</h2>
            <p className="text-muted-foreground text-sm">
              Generated from your idea and the clarification interview.
            </p>
          </div>
          <Button variant="outline" onClick={onReset}>
            Start new session
          </Button>
        </div>

        <Section
          title="User stories"
          description="As a [role], I want [goal], so that [reason]"
          items={doc.user_stories}
          emptyText="No user stories were generated."
        />
        <Section
          title="Acceptance criteria"
          description="Given / When / Then — traceable to the stories"
          items={doc.acceptance_criteria}
          emptyText="No acceptance criteria were generated."
        />
        <Section
          title="Assumptions"
          description="Includes every category that stayed unresolved — nothing is silently guessed"
          items={doc.assumptions}
          emptyText="No assumptions — every category was resolved in the interview."
        />
        <Section
          title="Risks"
          description="Delivery and product risks specific to this idea"
          items={doc.risks}
          emptyText="No risks were identified."
        />
      </div>
    </ScrollArea>
  );
}
