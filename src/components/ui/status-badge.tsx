import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/badge"
import type { HoldStatus, SlotStatus } from "@/lib/holds/status"

type Status = SlotStatus | HoldStatus

// Статус ніколи не лише кольором: слово друкується завжди, маркер повторює його формою (DESIGN.md, «Статуси»).
const STATUS = {
  Free: { variant: "free", marker: "○" },
  Held: { variant: "held", marker: "◐" },
  Confirmed: { variant: "confirmed", marker: "●" },
  Past: { variant: "past", marker: "–" },
  Expired: { variant: "expired", marker: "⊘" },
} as const satisfies Record<Status, { variant: string; marker: string }>

function StatusBadge({ status, ...props }: { status: Status } & ComponentProps<"span">) {
  const { variant, marker } = STATUS[status]
  return (
    <Badge variant={variant} {...props}>
      <span aria-hidden="true">{marker}</span>
      {status}
    </Badge>
  )
}

export { StatusBadge }
