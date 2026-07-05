"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Category, GapReport, RequirementStatus } from "@/agent/schemas";

// Display order mirrors the agent's questioning priority.
const ROWS: { key: Category; label: string }[] = [
  { key: "data_model", label: "Data model" },
  { key: "auth_roles", label: "Auth & roles" },
  { key: "payments", label: "Payments" },
  { key: "integrations", label: "Integrations" },
  { key: "notifications", label: "Notifications" },
  { key: "security_compliance", label: "Security & compliance" },
  { key: "non_functional", label: "Non-functional" },
];

const BADGE: Record<
  RequirementStatus,
  { variant: "default" | "secondary" | "outline"; label: string }
> = {
  resolved: { variant: "default", label: "resolved" },
  ambiguous: { variant: "secondary", label: "ambiguous" },
  missing: { variant: "outline", label: "missing" },
};

export function ChecklistPanel({ gaps }: { gaps: GapReport | null }) {
  const resolved = gaps
    ? Object.values(gaps).filter((g) => g.status === "resolved").length
    : 0;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Requirement checklist
          <span className="text-muted-foreground text-sm font-normal">
            {resolved}/7 resolved
          </span>
        </CardTitle>
        <CardDescription>Updated after every answer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROWS.map(({ key, label }) => {
          const gap = gaps?.[key];
          const badge = gap ? BADGE[gap.status] : null;
          return (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                {badge ? (
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                ) : (
                  <Badge variant="ghost">pending</Badge>
                )}
              </div>
              {gap?.resolvedValue && (
                <p
                  className="text-muted-foreground line-clamp-2 text-xs"
                  title={gap.resolvedValue}
                >
                  {gap.resolvedValue}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
