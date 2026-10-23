import { redirect } from "next/navigation";
import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { TimeZoneNote } from "@/app/_components/time-zone-note";
import { confirmHold } from "@/app/slots/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONFIRM_MESSAGES } from "@/lib/holds/messages";
import { buildHoldsList } from "@/lib/holds/schedule";
import { formatPracticeDateTime } from "@/lib/holds/time";
import { isStaff, type ClientRow, type HoldRow, type SlotRow, type TherapistRow } from "@/lib/holds/types";
import { allRows } from "@/lib/supabase/all-rows";
import { requireViewer } from "@/lib/supabase/viewer";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const MESSAGES = Object.fromEntries(
  Object.entries(CONFIRM_MESSAGES).map(([code, text]) => [`confirm.${code}`, text]),
) as Record<string, string>;

// Список утримань планувальника й адміністратора: лише Held і Expired, слот яких ще не почався, за часом слоту
// (AC-HOLD-20, AC-HOLD-28, AC-HOLD-29, AC-HOLD-37, AC-HOLD-38, AC-HOLD-42).
export default async function HoldsPage({ searchParams }: PageProps<"/holds">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  if (!isStaff(viewer.role)) redirect("/schedule");
  const now = new Date();

  // Утримання, клієнти й терапевти одне від одного не залежать — паралельно. База віддає лише утримання слотів, що ще
  // не почались (AC-HOLD-29, AC-HOLD-42), разом зі слотом; підтверджені не відкидаємо тут: за ними buildHoldsList
  // ховає старе «Expired» того самого клієнта (AC-HOLD-37), а потім і самі відкидає (AC-HOLD-38). Тому набір має бути
  // повним — читаємо всі сторінки Data API; довідники клієнтів і терапевтів — так само.
  const [rows, clientRows, therapistRows] = await Promise.all([
    allRows((from, to) =>
      viewer.supabase
        .from("holds")
        .select(
          "id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at, slots!inner(id, therapist_id, starts_at, ends_at)",
        )
        .gt("slots.starts_at", now.toISOString())
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      viewer.supabase.from("clients").select("id, name, email, guardian_email").order("id").range(from, to),
    ),
    allRows((from, to) => viewer.supabase.from("therapists").select("id, name, email").order("id").range(from, to)),
  ]);
  const holds: HoldRow[] = rows.map((row) => ({
    id: row.id,
    slot_id: row.slot_id,
    client_id: row.client_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    confirmed_at: row.confirmed_at,
    released_at: row.released_at,
  }));
  const slots: SlotRow[] = rows.map((row) => row.slots);
  const clients: ClientRow[] = clientRows;
  const therapists: TherapistRow[] = therapistRows;

  const items = buildHoldsList(holds, slots, clients, therapists, now);
  const errorCode = first(params.error);
  const okCode = first(params.ok);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/holds" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Holds</h1>
          <TimeZoneNote />
        </div>
        <ActionAlerts
          error={errorCode ? MESSAGES[errorCode] : undefined}
          ok={okCode ? MESSAGES[okCode] : undefined}
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holds.</p>
        ) : (
          <Card className="gap-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Therapist</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Held until</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.holdId}>
                    <TableCell className="tabular-nums">{formatPracticeDateTime(item.slotStartsAt)}</TableCell>
                    <TableCell>{item.therapistName}</TableCell>
                    <TableCell>
                      {item.clientName} ({item.clientContact})
                    </TableCell>
                    <TableCell data-testid="hold-status">
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.heldUntil ? (
                        formatPracticeDateTime(item.heldUntil)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.status === "Held" ? (
                        <form action={confirmHold}>
                          <input type="hidden" name="back" value="/holds" />
                          <input type="hidden" name="hold_id" value={item.holdId} />
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
        )}
      </main>
    </>
  );
}
