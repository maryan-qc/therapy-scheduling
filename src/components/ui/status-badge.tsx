"use client"

import { InfoIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
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
// з клавіатури й дотиком ті самі пояснення дає StatusGuide.
function StatusBadge({ status, ...props }: { status: Status } & ComponentProps<"span">) {
  return (
    <Tooltip>
      <TooltipTrigger render={<StatusMark status={status} {...props} />} />
      <TooltipContent>{STATUS[status].hint}</TooltipContent>
    </Tooltip>
  )
}

// Довідка про всі статуси — одна кнопка на сторінку біля підпису поясу. Popover, а не підказка: відкривається
// натисканням — мишею, дотиком, Enter чи пробілом; Esc закриває й повертає фокус на кнопку.
function StatusGuide() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="xs" className="text-muted-foreground" />}>
        <InfoIcon aria-hidden="true" data-icon="inline-start" />
        Status guide
      </PopoverTrigger>
      {/* 384 px, але не ширше за місце до краю екрана (--available-width рахує Base UI). */}
      <PopoverContent side="bottom" align="start" className="w-96 max-w-(--available-width) gap-2 p-3">
        <PopoverTitle>Statuses</PopoverTitle>
        {(Object.keys(STATUS) as Status[]).map((status) => (
          <span key={status} className="flex items-center gap-2 text-small">
            <StatusMark status={status} />
            {STATUS[status].hint}
          </span>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export { StatusBadge, StatusGuide }
