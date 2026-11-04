import { CalendarXIcon, CheckIcon, HourglassIcon } from "lucide-react";
import { EmptyState } from "@/app/_components/empty-state";
import { HoldCountdown } from "@/app/_components/hold-countdown";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DaySlot, DayView } from "@/lib/holds/day-view";
import { formatPracticeDateTime, formatPracticeTime } from "@/lib/holds/time";
import { clientContact, type ClientRow } from "@/lib/holds/types";
import { confirmHold, holdSlot } from "./actions";

interface TableProps {
  /** Клієнти, яких можна обрати для утримання (уже звужені пошуком). */
  clients: ClientRow[];
  /** Куди повернутись після дії — той самий терапевт, день і пошук. */
  back: string;
  /** Слот, який щойно змінила дія (DESIGN.md, розділ 7). */
  changed?: string;
  okCode?: string;
  now: Date;
}

// День на /slots: без слотів — порожній стан, інакше «No free slots on this day.» (якщо вільних немає) і таблиця.
export function DaySlots({ view, ...props }: { view: DayView } & TableProps) {
  if (view.slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarXIcon aria-hidden="true" />}
        tone="free"
        title={view.message}
        hint="Try another day or therapist."
        testId="day-message"
      />
    );
  }
  return (
    <>
      {view.message ? (
        <p data-testid="day-message" className="text-sm text-muted-foreground">
          {view.message}
        </p>
      ) : null}
      <SlotsTable slots={view.slots} {...props} />
    </>
  );
}

// Таблиця слотів дня: статус, клієнт, «Held until» з відліком і дії Hold / Confirm у рядку.
function SlotsTable({ slots, clients, back, changed, okCode, now }: { slots: DaySlot[] } & TableProps) {
  return (
    <Card className="gap-0 py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Held until</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <TableRow
              // Код дії в ключі зміненого рядка: після Hold, а потім Confirm того самого слота рядок монтується
              // заново, і підсвітка запускається вдруге (інакше React лишив би той самий DOM з тим самим атрибутом).
              key={slot.id === changed ? `${slot.id}:${okCode}` : slot.id}
              className={slot.status === "Past" ? "text-muted-foreground" : undefined}
              data-changed={slot.id === changed || undefined}
            >
              <TableCell className="tabular-nums">
                {formatPracticeTime(slot.startsAt)}–{formatPracticeTime(slot.endsAt)}
              </TableCell>
              <TableCell data-testid="slot-status">
                <StatusBadge status={slot.status} />
              </TableCell>
              <TableCell>
                {slot.hold ? (
                  `${slot.hold.clientName} (${slot.hold.clientContact})`
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {slot.hold?.heldUntil ? (
                  <>
                    {`Held until ${formatPracticeDateTime(slot.hold.heldUntil)}`}
                    <HoldCountdown until={slot.hold.heldUntil} now={now.getTime()} />
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {slot.canHold ? (
                  <form action={holdSlot} className="flex gap-2">
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="slot_id" value={slot.id} />
                    <input type="hidden" name="changed" value={slot.id} />
                    <NativeSelect name="client_id" defaultValue="" size="sm" aria-label="Client">
                      <NativeSelectOption value="" disabled>
                        Client…
                      </NativeSelectOption>
                      {clients.map((client) => (
                        <NativeSelectOption key={client.id} value={client.id}>
                          {client.name} ({clientContact(client)})
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <SubmitButton
                      variant="outline"
                      size="sm"
                      icon={<HourglassIcon aria-hidden="true" data-icon="inline-start" />}
                    >
                      Hold
                    </SubmitButton>
                  </form>
                ) : null}
                {slot.status === "Held" && slot.hold ? (
                  <form action={confirmHold}>
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="hold_id" value={slot.hold.id} />
                    <input type="hidden" name="changed" value={slot.id} />
                    <SubmitButton
                      variant="outline"
                      size="sm"
                      icon={<CheckIcon aria-hidden="true" data-icon="inline-start" />}
                    >
                      Confirm
                    </SubmitButton>
                  </form>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
