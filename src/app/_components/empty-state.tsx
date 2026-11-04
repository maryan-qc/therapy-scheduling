import type * as React from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// М'який тінт кола — статус, про який цей список; без статусу — нейтральний muted.
const TONE = {
  free: "bg-status-free text-status-free-foreground",
  held: "bg-status-held text-status-held-foreground",
  neutral: undefined,
} as const;

// Порожній стан списку (DESIGN.md, розділ 6): іконка в колі, текст дослівно з AC і, за потреби, що робити далі.
export function EmptyState({
  icon,
  tone = "neutral",
  title,
  hint,
  testId,
}: {
  icon: React.ReactNode;
  tone?: keyof typeof TONE;
  title: string | null;
  hint?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={TONE[tone]}>
          {icon}
        </EmptyMedia>
        <EmptyTitle data-testid={testId}>{title}</EmptyTitle>
        {hint ? <EmptyDescription>{hint}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}
