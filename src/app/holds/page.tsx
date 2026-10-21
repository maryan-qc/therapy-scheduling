import { redirect } from "next/navigation";
import { Nav } from "@/app/_components/nav";
import { confirmHold } from "@/app/slots/actions";
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

  const { data: holdRows } = await viewer.supabase
    .from("holds")
    .select("id, slot_id, client_id, created_at, expires_at, confirmed_at, released_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const holds: HoldRow[] = holdRows ?? [];
  const slotIds = [...new Set(holds.map((hold) => hold.slot_id))];
  const { data: slotRows } =
    slotIds.length > 0
      ? await viewer.supabase.from("slots").select("id, therapist_id, starts_at, ends_at").in("id", slotIds)
      : { data: [] };
  const slots: SlotRow[] = slotRows ?? [];
  const { data: clientRows } = await viewer.supabase.from("clients").select("id, name, email");
  const clients: ClientRow[] = clientRows ?? [];
  const { data: therapistRows } = await viewer.supabase.from("therapists").select("id, name, email");
  const therapists: TherapistRow[] = therapistRows ?? [];

  const items = buildHoldsList(holds, slots, clients, therapists, now);
  const errorCode = first(params.error);
  const okCode = first(params.ok);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <h1 className="text-2xl font-semibold">Holds</h1>
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
        {items.length === 0 ? <p className="text-sm text-zinc-500">No holds.</p> : null}
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Slot</th>
              <th className="py-1">Therapist</th>
              <th className="py-1">Client</th>
              <th className="py-1">Status</th>
              <th className="py-1">Held until</th>
              <th className="py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.holdId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2">{formatPracticeDateTime(item.slotStartsAt)}</td>
                <td className="py-2">{item.therapistName}</td>
                <td className="py-2">
                  {item.clientName} ({item.clientEmail})
                </td>
                <td className="py-2" data-testid="hold-status">
                  {item.status}
                </td>
                <td className="py-2">{item.heldUntil ? formatPracticeDateTime(item.heldUntil) : "—"}</td>
                <td className="py-2">
                  {item.status === "Held" ? (
                    <form action={confirmHold}>
                      <input type="hidden" name="back" value="/holds" />
                      <input type="hidden" name="hold_id" value={item.holdId} />
                      <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
                        Confirm
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
