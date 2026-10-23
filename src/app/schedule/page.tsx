import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/app/_components/nav";
import { TimeZoneNote } from "@/app/_components/time-zone-note";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildSchedule } from "@/lib/holds/schedule";
import {
  addDays,
  formatPracticeDateTime,
  formatPracticeTime,
  isValidDate,
  practiceDate,
  practiceWeekRange,
} from "@/lib/holds/time";
import { isStaff, type ClientName, type HoldRow, type SlotRow } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Розклад терапевта: тиждень пн–нд з усіма власними слотами й статусами, перемикання тижнів
// (AC-HOLD-09, AC-HOLD-21, AC-HOLD-30, AC-HOLD-31). Планувальник і адміністратор працюють на /slots.
export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  if (isStaff(viewer.role)) redirect("/slots");
  const now = new Date();

  // RLS: терапевт бачить лише свій рядок, свої слоти, утримання на них і їхніх клієнтів.
  const { data: therapist } = await viewer.supabase.from("therapists").select("id, name, email").maybeSingle();

  const requested = first(params.week);
  const week = practiceWeekRange(requested && isValidDate(requested) ? requested : practiceDate(now));

  let slots: SlotRow[] = [];
  let holds: HoldRow[] = [];
  let clients: ClientName[] = [];
  if (therapist) {
    const { data: slotRows } = await viewer.supabase
      .from("slots")
      .select("id, therapist_id, starts_at, ends_at")
      .eq("therapist_id", therapist.id)
      .gte("starts_at", week.start.toISOString())
      .lt("starts_at", week.end.toISOString())
      .order("starts_at");
    slots = slotRows ?? [];
    if (slots.length > 0) {
      // Утримання на слоти тижня й клієнти одне від одного не залежать — паралельно.
      const [{ data: holdRows }, { data: clientRows }] = await Promise.all([
        viewer.supabase
          .from("holds")
          .select("id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at")
          .in(
            "slot_id",
            slots.map((slot) => slot.id),
          )
          .is("released_at", null),
        // У розкладі — лише ім'я клієнта, email терапевт тут не бачить (AC-HOLD-40).
        viewer.supabase.from("clients").select("id, name"),
      ]);
      holds = holdRows ?? [];
      clients = clientRows ?? [];
    }
  }

  const days = therapist ? buildSchedule(therapist.id, week.monday, slots, holds, clients, now) : [];
  const weekLink = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/schedule" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">My schedule</h1>
            <TimeZoneNote />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/schedule?week=${addDays(week.monday, -7)}`} className={weekLink}>
              ← Previous week
            </Link>
            <span className="font-medium tabular-nums" data-testid="week">
              {week.monday} – {week.sunday}
            </span>
            <Link href={`/schedule?week=${addDays(week.monday, 7)}`} className={weekLink}>
              Next week →
            </Link>
          </div>
        </div>
        {therapist ? null : <p className="text-sm">No therapist is linked to {viewer.email ?? "this user"}.</p>}
        {days.map((day) => (
          <section key={day.date} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold tabular-nums">{day.date}</h2>
            {day.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slots.</p>
            ) : (
              <Card className="gap-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Time</TableHead>
                      <TableHead className="w-36">Status</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Held until</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {day.slots.map((slot) => (
                      <TableRow
                        key={slot.id}
                        className={slot.status === "Past" ? "text-muted-foreground" : undefined}
                      >
                        <TableCell className="tabular-nums">
                          {formatPracticeTime(slot.startsAt)}–{formatPracticeTime(slot.endsAt)}
                        </TableCell>
                        <TableCell data-testid="slot-status">
                          <StatusBadge status={slot.status} />
                        </TableCell>
                        <TableCell>{slot.hold ? slot.hold.clientName : ""}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {slot.hold?.heldUntil ? `Held until ${formatPracticeDateTime(slot.hold.heldUntil)}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
