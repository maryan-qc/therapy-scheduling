"use client"

import { InfoIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { HoldStatus, SlotStatus } from "@/lib/holds/status"

type Status = SlotStatus | HoldStatus

// Статус ніколи не лише кольором: слово друкується завжди, маркер повторює його формою (DESIGN.md, «Статуси»).
// Підказка — одне речення, що означає статус; вона лише доповнює слово.
const STATUS = {
  Free: { variant: "free", marker: "○", hint: "Nobody holds this slot." },
  Held: { variant: "held", marker: "◐", hint: "Held for a client and waiting for confirmation within 24 hours." },
  Confirmed: { variant: "confirmed", marker: "●", hint: "The hold is confirmed." },
  Past: { variant: "past", marker: "–", hint: "The slot has started or ended." },
  Expired: { variant: "expired", marker: "⊘", hint: "The hold was not confirmed within 24 hours." },
} as const satisfies Record<Status, { variant: string; marker: string; hint: string }>

function StatusMark({ status, ...props }: { status: Status } & ComponentProps<"span">) {
  const { variant, marker } = STATUS[status]
  return (
    <Badge variant={variant} {...props}>
      <span aria-hidden="true">{marker}</span>
      {status}
    </Badge>
  )
}

// Бейдж не отримує фокусу (інакше кожен рядок таблиці — зайва зупинка Tab), тож підказка на ньому — лише для миші;
// з клавіатури ті самі пояснення дає StatusGuide.
function StatusBadge({ status, ...props }: { status: Status } & ComponentProps<"span">) {
  return (
    <Tooltip>
      <TooltipTrigger render={<StatusMark status={status} {...props} />} />
      <TooltipContent>{STATUS[status].hint}</TooltipContent>
    </Tooltip>
  )
}

// Довідка про всі статуси — одна кнопка на сторінку біля підпису поясу: відкривається наведенням і фокусом.
function StatusGuide() {
  return (
    <Tooltip>
      <TooltipTrigger
        closeOnClick={false}
        render={<Button variant="ghost" size="xs" className="text-muted-foreground" />}
      >
        <InfoIcon aria-hidden="true" data-icon="inline-start" />
        Status guide
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm flex-col items-start gap-2 p-3">
        {(Object.keys(STATUS) as Status[]).map((status) => (
          <span key={status} className="flex items-center gap-2">
            <StatusMark status={status} />
            {STATUS[status].hint}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

export { StatusBadge, StatusGuide }
