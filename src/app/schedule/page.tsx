import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/app/_components/nav";
import { buildSchedule } from "@/lib/holds/schedule";
import {
  addDays,
  formatPracticeDateTime,
  formatPracticeTime,
  isValidDate,
  practiceDate,
  practiceWeekRange,
} from "@/lib/holds/time";
import { isStaff, type ClientRow, type HoldRow, type SlotRow } from "@/lib/holds/types";
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
  let clients: ClientRow[] = [];
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
      const { data: holdRows } = await viewer.supabase
        .from("holds")
        .select("id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at")
        .in(
          "slot_id",
          slots.map((slot) => slot.id),
        )
        .is("released_at", null);
      holds = holdRows ?? [];
      const { data: clientRows } = await viewer.supabase.from("clients").select("id, name, email");
      clients = clientRows ?? [];
    }
  }

  const days = therapist ? buildSchedule(therapist.id, week.monday, slots, holds, clients, now) : [];

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="text-2xl font-semibold">My schedule</h1>
        {therapist ? null : <p className="text-sm">No therapist is linked to {viewer.email ?? "this user"}.</p>}
        <div className="flex items-center gap-4 text-sm">
          <Link href={`/schedule?week=${addDays(week.monday, -7)}`} className="underline">
            ← Previous week
          </Link>
          <span className="font-medium" data-testid="week">
            {week.monday} – {week.sunday}
          </span>
          <Link href={`/schedule?week=${addDays(week.monday, 7)}`} className="underline">
            Next week →
          </Link>
        </div>
        {days.map((day) => (
          <section key={day.date} className="flex flex-col gap-1">
            <h2 className="text-base font-medium">{day.date}</h2>
            {day.slots.length === 0 ? (
              <p className="text-sm text-zinc-500">No slots.</p>
            ) : (
              <ul className="text-sm">
                {day.slots.map((slot) => (
                  <li key={slot.id} className="flex gap-3 border-t border-zinc-200 py-1 dark:border-zinc-800">
                    <span className="w-28">
                      {formatPracticeTime(slot.startsAt)}–{formatPracticeTime(slot.endsAt)}
                    </span>
                    <span className="w-24" data-testid="slot-status">
                      {slot.status}
                    </span>
                    <span>{slot.hold ? slot.hold.clientName : ""}</span>
                    <span className="text-zinc-500">
                      {slot.hold?.heldUntil ? `Held until ${formatPracticeDateTime(slot.hold.heldUntil)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </>
  );
}
