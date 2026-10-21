import { Nav } from "@/app/_components/nav";
import { CLIENT_MESSAGES, type ClientErrorCode } from "@/lib/holds/clients";
import { buildDayView } from "@/lib/holds/day-view";
import {
  formatPracticeDateTime,
  formatPracticeTime,
  isValidDate,
  practiceDate,
  practiceDayRange,
  PRACTICE_TIME_ZONE,
} from "@/lib/holds/time";
import { isStaff, type ClientRow, type HoldRow, type SlotRow, type TherapistRow } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { addClient } from "./actions";

const MESSAGES: Record<string, string> = {
  ...(CLIENT_MESSAGES satisfies Record<ClientErrorCode, string>),
  CLIENT_FORBIDDEN: "Only schedulers and admins can create clients.",
  CLIENT_CREATED: "Client created.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Слоти терапевта на день зі статусами (AC-HOLD-01, 18, 24, 32, 33) і картки клієнтів (AC-HOLD-10, 11, 15, 16, 34, 35).
export default async function SlotsPage({ searchParams }: PageProps<"/slots">) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const now = new Date();
  const staff = isStaff(viewer.role);

  // RLS: планувальник і адміністратор бачать усіх терапевтів, терапевт — лише себе.
  const { data: therapistRows } = await viewer.supabase
    .from("therapists")
    .select("id, name, email")
    .order("name");
  const therapists: TherapistRow[] = therapistRows ?? [];
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

  const { data: clientRows } = await viewer.supabase.from("clients").select("id, name, email").order("name");
  const clients: ClientRow[] = clientRows ?? [];
  const view = buildDayView(slots, holds, clients, now);

  const back = `/slots?therapist=${therapist?.id ?? ""}&date=${date}`;
  const errorCode = first(params.error);
  const okCode = first(params.ok);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="text-2xl font-semibold">Therapist slots</h1>

        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Therapist
            <select
              name="therapist"
              defaultValue={therapist?.id}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
            >
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
            />
          </label>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            Show
          </button>
          <span className="text-zinc-500">Time zone: {PRACTICE_TIME_ZONE}</span>
        </form>

        {errorCode && MESSAGES[errorCode] ? (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {MESSAGES[errorCode]}
          </p>
        ) : null}
        {okCode && MESSAGES[okCode] ? (
          <p role="status" className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
            {MESSAGES[okCode]}
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {therapist?.name ?? "No therapist"} · {date}
          </h2>
          {view.message ? (
            <p data-testid="day-message" className="text-sm font-medium">
              {view.message}
            </p>
          ) : null}
          {view.slots.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1">Time</th>
                  <th className="py-1">Status</th>
                  <th className="py-1">Client</th>
                  <th className="py-1">Held until</th>
                </tr>
              </thead>
              <tbody>
                {view.slots.map((slot) => (
                  <tr key={slot.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2">
                      {formatPracticeTime(slot.startsAt)}–{formatPracticeTime(slot.endsAt)}
                    </td>
                    <td className="py-2" data-testid="slot-status">
                      {slot.status}
                    </td>
                    <td className="py-2">{slot.hold ? `${slot.hold.clientName} (${slot.hold.clientEmail})` : "—"}</td>
                    <td className="py-2">
                      {slot.hold?.heldUntil ? `Held until ${formatPracticeDateTime(slot.hold.heldUntil)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        {staff ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Clients</h2>
            <form action={addClient} className="flex flex-wrap items-end gap-3 text-sm">
              <input type="hidden" name="back" value={back} />
              <label className="flex flex-col gap-1">
                Name
                <input name="name" className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700" />
              </label>
              <label className="flex flex-col gap-1">
                Email
                <input name="email" className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700" />
              </label>
              <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
                Create client
              </button>
            </form>
            <ul className="text-sm" data-testid="clients">
              {clients.map((client) => (
                <li key={client.id}>
                  {client.name} — {client.email}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
