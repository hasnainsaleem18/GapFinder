"use client";

import { CircleAlert, CircleCheck, CircleDashed, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

const STATUS: Record<
  RequirementStatus,
  { label: string; icon: typeof CircleCheck; iconClass: string; badgeClass: string }
> = {
  resolved: {
    label: "Resolved",
    icon: CircleCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  ambiguous: {
    label: "Ambiguous",
    icon: CircleAlert,
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  },
  missing: {
    label: "Missing",
    icon: CircleDashed,
    iconClass: "text-muted-foreground/60",
    badgeClass: "border-dashed bg-transparent text-muted-foreground",
  },
};

export function ChecklistPanel({ gaps }: { gaps: GapReport | null }) {
  const resolved = gaps
    ? Object.values(gaps).filter((g) => g.status === "resolved").length
    : 0;

  return (
    <Card className="h-fit gap-4 py-5 shadow-sm">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <ListChecks className="text-primary size-4" />
            Requirements checklist
          </span>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {resolved}/7 resolved
          </span>
        </CardTitle>
        <CardDescription className="text-xs">
          Updates after every answer
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="divide-border/70 divide-y">
          {ROWS.map(({ key, label }) => {
            const gap = gaps?.[key];
            const status = gap ? STATUS[gap.status] : null;
            const Icon = status?.icon ?? CircleDashed;
            return (
              <div key={key} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors duration-300",
                        status?.iconClass ?? "text-muted-foreground/40"
                      )}
                    />
                    <span className="truncate font-medium">{label}</span>
                  </span>
                  {status ? (
                    <Badge
                      key={gap!.status}
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[11px] animate-in fade-in zoom-in-95 duration-300",
                        status.badgeClass
                      )}
                    >
                      {status.label}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground shrink-0 border-dashed text-[11px]"
                    >
                      Pending
                    </Badge>
                  )}
                </div>
                {gap?.resolvedValue && (
                  <p
                    className="text-muted-foreground line-clamp-2 pl-6 text-xs leading-relaxed"
                    title={gap.resolvedValue}
                  >
                    {gap.resolvedValue}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
