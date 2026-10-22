import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { TimeZoneNote } from "@/app/_components/time-zone-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLIENT_MESSAGES, type ClientErrorCode } from "@/lib/holds/clients";
import { buildDayView } from "@/lib/holds/day-view";
import { CONFIRM_MESSAGES, HOLD_MESSAGES } from "@/lib/holds/messages";
import {
  formatPracticeDateTime,
  formatPracticeTime,
  isValidDate,
  practiceDate,
  practiceDayRange,
} from "@/lib/holds/time";
import { isStaff, type ClientRow, type HoldRow, type SlotRow, type TherapistRow } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { addClient, confirmHold, holdSlot } from "./actions";

const MESSAGES: Record<string, string> = {
  ...(CLIENT_MESSAGES satisfies Record<ClientErrorCode, string>),
  CLIENT_FORBIDDEN: "Only schedulers and admins can create clients.",
  CLIENT_CREATED: "Client created.",
  ...Object.fromEntries(Object.entries(HOLD_MESSAGES).map(([code, text]) => [`hold.${code}`, text])),
  ...Object.fromEntries(Object.entries(CONFIRM_MESSAGES).map(([code, text]) => [`confirm.${code}`, text])),
  "hold.CLIENT_REQUIRED": "Select a client to hold the slot.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Слоти терапевта на день зі статусами (AC-HOLD-01, 18, 24, 32, 33) і картки клієнтів (AC-HOLD-10, 11, 15, 16, 34, 35).
export default async function SlotsPage({ searchParams }: PageProps<"/slots">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const now = new Date();
  const staff = isStaff(viewer.role);

  // RLS: планувальник і адміністратор бачать усіх терапевтів, терапевт — лише себе.
  // Терапевти й клієнти одне від одного не залежать — один round trip до бази замість двох.
  const [{ data: therapistRows }, { data: clientRows }] = await Promise.all([
    viewer.supabase.from("therapists").select("id, name, email").order("name"),
    viewer.supabase.from("clients").select("id, name, email").order("name"),
  ]);
  const therapists: TherapistRow[] = therapistRows ?? [];
  const clients: ClientRow[] = clientRows ?? [];
  const therapist = therapists.find((t) => t.id === first(params.therapist)) ?? therapists[0];

  const requestedDate = first(params.date);
  const date = requestedDate && isValidDate(requestedDate) ? requestedDate : practiceDate(now);
  const { start, end } = practiceDayRange(date);

  let slots: SlotRow[] = [];
  let holds: HoldRow[] = [];
  if (therapist) {
    const { data: slotRows } = await viewer.supabase
      .from("slots")
      .select("id, therapist_id, starts_at, ends_at")
      .eq("therapist_id", therapist.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at");
    slots = slotRows ?? [];
    if (slots.length > 0) {
      const { data: holdRows } = await viewer.supabase
        .from("holds")
        .select("id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at")
        .in(
          "slot_id",
          slots.map((slot) => slot.id),
        )
        .is("released_at", null);
      holds = holdRows ?? [];
    }
  }

  const view = buildDayView(slots, holds, clients, now);

  const back = `/slots?therapist=${therapist?.id ?? ""}&date=${date}`;
  const errorCode = first(params.error);
  const okCode = first(params.ok);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/slots" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Therapist slots</h1>
            <TimeZoneNote />
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="therapist">Therapist</Label>
              <NativeSelect id="therapist" name="therapist" defaultValue={therapist?.id}>
                {therapists.map((t) => (
                  <NativeSelectOption key={t.id} value={t.id}>
                    {t.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" name="date" defaultValue={date} className="tabular-nums" />
            </div>
            <Button type="submit" variant="outline">
              Show
            </Button>
          </form>
        </div>

        <ActionAlerts
          error={errorCode ? MESSAGES[errorCode] : undefined}
          ok={okCode ? MESSAGES[okCode] : undefined}
        />

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tabular-nums">
            {therapist?.name ?? "No therapist"} · {date}
          </h2>
          {view.message ? (
            <p data-testid="day-message" className="text-sm text-muted-foreground">
              {view.message}
            </p>
          ) : null}
          {view.slots.length > 0 ? (
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Held until</TableHead>
                    {staff ? <TableHead>Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.slots.map((slot) => (
                    <TableRow key={slot.id} className={slot.status === "Past" ? "text-muted-foreground" : undefined}>
                      <TableCell className="tabular-nums">
                        {formatPracticeTime(slot.startsAt)}–{formatPracticeTime(slot.endsAt)}
                      </TableCell>
                      <TableCell data-testid="slot-status">
                        <StatusBadge status={slot.status} />
                      </TableCell>
                      <TableCell>
                        {slot.hold ? (
                          `${slot.hold.clientName} (${slot.hold.clientEmail})`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {slot.hold?.heldUntil ? (
                          `Held until ${formatPracticeDateTime(slot.hold.heldUntil)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {staff ? (
                        <TableCell>
                          {slot.canHold ? (
                            <form action={holdSlot} className="flex gap-2">
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="slot_id" value={slot.id} />
                              <NativeSelect name="client_id" defaultValue="" size="sm" aria-label="Client">
                                <NativeSelectOption value="" disabled>
                                  Client…
                                </NativeSelectOption>
                                {clients.map((client) => (
                                  <NativeSelectOption key={client.id} value={client.id}>
                                    {client.name} ({client.email})
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                              <Button type="submit" variant="outline" size="sm">
                                Hold
                              </Button>
                            </form>
                          ) : null}
                          {slot.status === "Held" && slot.hold ? (
                            <form action={confirmHold}>
                              <input type="hidden" name="back" value={back} />
                              <input type="hidden" name="hold_id" value={slot.hold.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Confirm
                              </Button>
                            </form>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </section>

        {staff ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Clients</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form action={addClient} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="back" value={back} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-name">Name</Label>
                  <Input id="client-name" name="name" className="w-56" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-email">Email</Label>
                  <Input id="client-email" name="email" className="w-64" />
                </div>
                <Button type="submit">Create client</Button>
              </form>
              <ul className="flex flex-col gap-1 text-sm" data-testid="clients">
                {clients.map((client) => (
                  <li key={client.id}>
                    {client.name} <span className="text-muted-foreground">— {client.email}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  );
}
