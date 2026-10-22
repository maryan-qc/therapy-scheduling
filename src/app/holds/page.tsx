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
import { requireViewer } from "@/lib/supabase/viewer";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const MESSAGES = Object.fromEntries(
  Object.entries(CONFIRM_MESSAGES).map(([code, text]) => [`confirm.${code}`, text]),
) as Record<string, string>;

// Утримання для планувальника й адміністратора: Held / Confirmed / Expired; прострочене — лише до початку слоту
// (AC-HOLD-20, AC-HOLD-28, AC-HOLD-29).
export default async function HoldsPage({ searchParams }: PageProps<"/holds">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  if (!isStaff(viewer.role)) redirect("/schedule");
  const now = new Date();

  // Утримання, клієнти й терапевти одне від одного не залежать — паралельно; слоти — за id з утримань.
  const [{ data: holdRows }, { data: clientRows }, { data: therapistRows }] = await Promise.all([
    viewer.supabase
      .from("holds")
      .select("id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at")
      .order("created_at", { ascending: false })
      .limit(500),
    viewer.supabase.from("clients").select("id, name, email"),
    viewer.supabase.from("therapists").select("id, name, email"),
  ]);
  const holds: HoldRow[] = holdRows ?? [];
  const clients: ClientRow[] = clientRows ?? [];
  const therapists: TherapistRow[] = therapistRows ?? [];
  const slotIds = [...new Set(holds.map((hold) => hold.slot_id))];
  const { data: slotRows } =
    slotIds.length > 0
      ? await viewer.supabase.from("slots").select("id, therapist_id, starts_at, ends_at").in("id", slotIds)
      : { data: [] };
  const slots: SlotRow[] = slotRows ?? [];

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
                      {item.clientName} ({item.clientEmail})
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
