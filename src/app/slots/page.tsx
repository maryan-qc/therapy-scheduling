import Link from "next/link";
import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { TimeZoneNote } from "@/app/_components/time-zone-note";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { matchesClient } from "@/lib/clients/search";
import { buildDayView } from "@/lib/holds/day-view";
import { CONFIRM_MESSAGES, HOLD_MESSAGES } from "@/lib/holds/messages";
import {
  formatPracticeDateTime,
  formatPracticeTime,
  isValidDate,
  practiceDate,
  practiceDayRange,
} from "@/lib/holds/time";
import {
  clientContact,
  staffPageError,
  type ClientRow,
  type HoldRow,
  type SlotRow,
  type TherapistRow,
} from "@/lib/holds/types";
import { allRows } from "@/lib/supabase/all-rows";
import { requireViewer } from "@/lib/supabase/viewer";
import { confirmHold, holdSlot } from "./actions";

const MESSAGES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(HOLD_MESSAGES).map(([code, text]) => [`hold.${code}`, text])),
  ...Object.fromEntries(Object.entries(CONFIRM_MESSAGES).map(([code, text]) => [`confirm.${code}`, text])),
  "hold.CLIENT_REQUIRED": "Select a client to hold the slot.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Слоти терапевта на день зі статусами (AC-HOLD-01, 18, 24, 32, 33) для планувальника й адміністратора; терапевт
// бачить лише відмову, без запитів до бази (AC-HOLD-44). Картки клієнтів створюють лише повною формою /clients/new
// (Sofiia-pm/therapy-scheduling-spec#20); тут — пошук клієнта для утримання за ім'ям чи email, дитини — і за email
// опікуна (AC-CARD-02).
export default async function SlotsPage({ searchParams }: PageProps<"/slots">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const now = new Date();
  const refusal = staffPageError(viewer.role);
  if (refusal) {
    return (
      <>
        <Nav email={viewer.email} role={viewer.role} current="/slots" />
        <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
          <h1 className="text-xl font-semibold tracking-tight">Therapist slots</h1>
          <ActionAlerts error={refusal} />
        </main>
      </>
    );
  }

  // Терапевти й клієнти одне від одного не залежать — паралельно. Довідник клієнтів — повний (усі сторінки Data API):
  // з нього утримані слоти беруть ім'я й контакт; пошук звужує лише список для нового утримання.
  const [{ data: therapistRows }, allClients] = await Promise.all([
    viewer.supabase.from("therapists").select("id, name, email").order("name"),
    allRows<ClientRow>((from, to) =>
      viewer.supabase.from("clients").select("id, name, email, guardian_email").order("name").order("id").range(from, to),
    ),
  ]);
  const therapists: TherapistRow[] = therapistRows ?? [];
  const clientQuery = first(params.client)?.trim() ?? "";
  const clients: ClientRow[] = allClients.filter((client) => matchesClient(client, clientQuery));
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

  const view = buildDayView(slots, holds, allClients, now);

  const back = `/slots?${new URLSearchParams({ therapist: therapist?.id ?? "", date, client: clientQuery }).toString()}`;
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client">Find client</Label>
              <Input
                id="client"
                name="client"
                defaultValue={clientQuery}
                placeholder="Name or email"
                className="w-56"
                aria-describedby="client-hint"
              />
            </div>
            <Button type="submit" variant="outline">
              Show
            </Button>
          </form>
        </div>
        <p id="client-hint" className="-mt-4 text-small text-muted-foreground">
          {clientQuery
            ? `Clients matching «${clientQuery}»: ${clients.length}. `
            : "Find a client by name or email; a child — also by the guardian's email. "}
          <Link href="/clients/new" className="underline underline-offset-3 hover:text-foreground">
            New client card
          </Link>
        </p>

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
                    <TableHead>Action</TableHead>
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
                          `${slot.hold.clientName} (${slot.hold.clientContact})`
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
                                    {client.name} ({clientContact(client)})
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </section>

      </main>
    </>
  );
}
