// Утримання й підтвердження — справжні функції бази private.hold_slot_at / private.confirm_hold_at
// (supabase/migrations/20261021160000_hold_and_confirm.sql) на PGlite з усіма міграціями й RLS.
// Час — параметр p_now, тож межі (14:29 / 14:30, 09:59 / 10:00) перевіряються без моків годинника.
// Показ (статус, «Held until») — той самий buildDayView, що й на сторінці /slots, з рядків, які планувальник
// читає з бази під своїм RLS.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildDayView } from "@/lib/holds/day-view";
import { CONFIRM_MESSAGES, HOLD_MESSAGES } from "@/lib/holds/messages";
import { formatPracticeDateTime, practiceDayRange } from "@/lib/holds/time";
import type { ClientRow, HoldRow, SlotRow } from "@/lib/holds/types";
import { at } from "../holds/fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;
let scheduler2: string;
let admin: string;
let therapist1: string;
let client1: string;
let client2: string;

type Result = { code: string; hold_id?: string };
/** Рядок holds повністю: сторінкам автори не потрібні, а тестам AC-HOLD-19/27/36 — так. */
type DbHold = HoldRow & { created_by: string | null; confirmed_by: string | null };

// PGlite віддає timestamptz як Date, а сторінка працює з ISO-рядками Supabase.
const iso = <T,>(row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as T;

async function slotId(therapistEmail: string, date: string, time: string): Promise<string> {
  const [row] = await t.asService<{ id: string }>(
    `select s.id from public.slots as s join public.therapists as th on th.id = s.therapist_id
     where th.email = $1 and s.starts_at = $2`,
    [therapistEmail, at(date, time)],
  );
  return row.id;
}

async function hold(userId: string, slot: string, client: string, nowAt: string): Promise<Result> {
  const [row] = await t.asUser<{ r: Result }>(userId, "select private.hold_slot_at($1, $2, $3) as r", [
    slot,
    client,
    nowAt,
  ]);
  return row.r;
}

async function confirm(userId: string, holdId: string, nowAt: string): Promise<Result> {
  const [row] = await t.asUser<{ r: Result }>(userId, "select private.confirm_hold_at($1, $2) as r", [holdId, nowAt]);
  return row.r;
}

async function holdsOf(slot: string): Promise<DbHold[]> {
  const rows = await t.asService<Record<string, unknown>>(
    "select * from public.holds where slot_id = $1 order by created_at",
    [slot],
  );
  return rows.map((r) => iso<DbHold>(r));
}

/** День терапевта так, як його бачить планувальник на /slots: рядки з бази під його RLS → buildDayView. */
async function dayView(userId: string, therapistEmail: string, date: string, nowAt: string) {
  const { start, end } = practiceDayRange(date);
  const slots = (
    await t.asUser<Record<string, unknown>>(
      userId,
      `select s.id, s.therapist_id, s.starts_at, s.ends_at from public.slots as s
       join public.therapists as th on th.id = s.therapist_id
       where th.email = $1 and s.starts_at >= $2 and s.starts_at < $3 order by s.starts_at`,
      [therapistEmail, start.toISOString(), end.toISOString()],
    )
  ).map((r) => iso<SlotRow>(r));
  const holds = (
    await t.asUser<Record<string, unknown>>(
      userId,
      "select * from public.holds where slot_id = any($1::uuid[]) and released_at is null",
      [slots.map((s) => s.id)],
    )
  ).map((r) => iso<HoldRow>(r));
  const clients = await t.asUser<ClientRow>(userId, "select id, name, email from public.clients");
  return buildDayView(slots, holds, clients, new Date(nowAt));
}

beforeAll(async () => {
  t = await createTestDb();
  scheduler1 = t.users["scheduler1@example.test"];
  scheduler2 = t.users["scheduler2@example.test"];
  admin = t.users["admin@example.test"];
  therapist1 = t.users["therapist1@example.test"];
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
  await t.asService("delete from public.clients");
  [{ id: client1 }, { id: client2 }] = await t.asService<{ id: string }>(
    `insert into public.clients (name, email) values ('client1', 'client1@example.test'), ('client2', 'client2@example.test')
     returning id`,
  );
});

describe("утримання слоту — функція бази private.hold_slot_at", () => {
  it("AC-HOLD-02: утримання 2026-11-02 14:30 — «Held», client1, «Held until 2026-11-03 14:30», слот ніхто не бачить вільним", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");

    expect((await hold(scheduler1, slot, client1, at("2026-11-02", "14:30"))).code).toBe("OK");
    expect(HOLD_MESSAGES.OK).toBe("Slot held.");

    const [row] = await holdsOf(slot);
    expect(formatPracticeDateTime(row.expires_at)).toBe("2026-11-03 14:30");
    const view = await dayView(scheduler2, "therapist1@example.test", "2026-11-05", at("2026-11-02", "14:31"));
    const shown = view.slots.find((s) => s.id === slot)!;
    expect(shown.status).toBe("Held");
    expect(shown.hold?.clientName).toBe("client1");
    expect(`Held until ${formatPracticeDateTime(shown.hold!.heldUntil!)}`).toBe("Held until 2026-11-03 14:30");
    expect(shown.canHold).toBe(false);
  });

  it("AC-HOLD-03: слот уже утримано за client1 — інший планувальник не утримає його за client2", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot, client1, at("2026-11-02", "14:30"));

    const second = await hold(scheduler2, slot, client2, at("2026-11-02", "15:00"));

    expect(second.code).toBe("SLOT_UNAVAILABLE");
    expect(HOLD_MESSAGES.SLOT_UNAVAILABLE).toBe("This slot is no longer available.");
    expect((await holdsOf(slot)).map((h) => h.client_id)).toEqual([client1]);
  });

  it("AC-HOLD-04: двоє планувальників на той самий слот — рівно одне утримання; друге відкрите утримання не пропускає база", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "11:00");

    const results = [
      await hold(scheduler1, slot, client1, at("2026-11-02", "14:30")),
      await hold(scheduler2, slot, client2, at("2026-11-02", "14:30")),
    ];

    expect(results.map((r) => r.code)).toEqual(["OK", "SLOT_UNAVAILABLE"]);
    // PGlite — одне з'єднання, тож справжньої паралельності тут немає. Тому окремо перевіряємо другу лінію захисту:
    // частковий unique index holds_one_open_per_slot не пропускає друге відкрите утримання навіть повз функцію.
    await expect(
      t.asService(
        `insert into public.holds (slot_id, client_id, created_at, expires_at)
         values ($1, $2, $3, $3::timestamptz + interval '1440 minutes')`,
        [slot, client2, at("2026-11-02", "14:30")],
      ),
    ).rejects.toThrow(/holds_one_open_per_slot|duplicate key/);
    expect(await holdsOf(slot)).toHaveLength(1);
  });

  it("AC-HOLD-05: о 2026-11-03 14:29 утримання від 2026-11-02 14:30 досі «Held» — слот не утримати за іншим клієнтом", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot, client1, at("2026-11-02", "14:30"));

    expect((await hold(scheduler2, slot, client2, at("2026-11-03", "14:29"))).code).toBe("SLOT_UNAVAILABLE");
    const view = await dayView(scheduler2, "therapist1@example.test", "2026-11-05", at("2026-11-03", "14:29"));
    expect(view.slots.find((s) => s.id === slot)!.status).toBe("Held");
  });

  it("AC-HOLD-06: о 2026-11-03 14:30 утримання «Expired», слот вільний і його можна утримати за іншим клієнтом", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot, client1, at("2026-11-02", "14:30"));

    const view = await dayView(scheduler2, "therapist1@example.test", "2026-11-05", at("2026-11-03", "14:30"));
    expect(view.slots.find((s) => s.id === slot)!.status).toBe("Free");
    expect((await hold(scheduler2, slot, client2, at("2026-11-03", "14:30"))).code).toBe("OK");

    const [expired, fresh] = await holdsOf(slot);
    expect(expired.client_id).toBe(client1);
    expect(expired.released_at).not.toBeNull(); // прострочене звільнила та сама функція
    expect(fresh.client_id).toBe(client2);
  });

  it("AC-HOLD-07: слот 10:00 о 10:05 — «This slot has already started and cannot be held.»", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");

    expect((await hold(scheduler1, slot, client1, at("2026-11-05", "10:05"))).code).toBe("SLOT_STARTED");
    expect(HOLD_MESSAGES.SLOT_STARTED).toBe("This slot has already started and cannot be held.");
    expect(await holdsOf(slot)).toHaveLength(0);
  });

  it("AC-HOLD-08: терапевт не утримує — «Only schedulers and admins can hold slots.»", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");

    expect((await hold(therapist1, slot, client1, at("2026-11-02", "14:30"))).code).toBe("HOLD_FORBIDDEN");
    expect(HOLD_MESSAGES.HOLD_FORBIDDEN).toBe("Only schedulers and admins can hold slots.");
    expect(await holdsOf(slot)).toHaveLength(0);
  });

  it("AC-HOLD-17: повторне утримання за client1 о 18:00 — нового немає, «Held until 2026-11-03 14:30» не змінено", async () => {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot, client1, at("2026-11-02", "14:30"));

    expect((await hold(scheduler1, slot, client1, at("2026-11-02", "18:00"))).code).toBe("SLOT_UNAVAILABLE");
    const rows = await holdsOf(slot);
    expect(rows).toHaveLength(1);
    expect(formatPracticeDateTime(rows[0].expires_at)).toBe("2026-11-03 14:30");
  });

  it("AC-HOLD-25: client1 уже «Held» у therapist1 о 10:00 — слот therapist2 о 10:00 за ним не утримати", async () => {
    const slot1 = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    const slot2 = await slotId("therapist2@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot1, client1, at("2026-11-02", "14:30"));

    expect((await hold(scheduler2, slot2, client1, at("2026-11-02", "15:00"))).code).toBe("CLIENT_BUSY");
    expect(HOLD_MESSAGES.CLIENT_BUSY).toBe("This client already has a hold or session at this time.");
    expect(await holdsOf(slot2)).toHaveLength(0);
  });

  it("AC-HOLD-26: прострочене утримання client1 у therapist1 не заважає утримати слот therapist2 на той самий час", async () => {
    const slot1 = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    const slot2 = await slotId("therapist2@example.test", "2026-11-05", "10:00");
    await hold(scheduler1, slot1, client1, at("2026-11-02", "14:30"));

    expect((await hold(scheduler2, slot2, client1, at("2026-11-03", "15:00"))).code).toBe("OK");
    expect((await holdsOf(slot2)).map((h) => h.client_id)).toEqual([client1]);
  });
});

describe("підтвердження утримання — функція бази private.confirm_hold_at", () => {
  async function heldSlot(createdAt: string, by = scheduler1) {
    const slot = await slotId("therapist1@example.test", "2026-11-05", "10:00");
    const result = await hold(by, slot, client1, createdAt);
    return { slot, holdId: result.hold_id! };
  }

  it("AC-HOLD-12: підтверджене утримання — «Confirmed», без «Held until», недоступне й після 24 годин", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"));

    expect((await confirm(scheduler1, holdId, at("2026-11-03", "09:00"))).code).toBe("OK");
    expect(CONFIRM_MESSAGES.OK).toBe("Hold confirmed.");
    const view = await dayView(scheduler1, "therapist1@example.test", "2026-11-05", at("2026-11-04", "15:00"));
    const shown = view.slots.find((s) => s.id === slot)!;
    expect(shown.status).toBe("Confirmed");
    expect(shown.hold?.heldUntil).toBeNull();
    expect((await hold(scheduler2, slot, client2, at("2026-11-04", "15:00"))).code).toBe("SLOT_UNAVAILABLE");
  });

  it("AC-HOLD-13: прострочене утримання не підтверджується — «This hold has expired. Hold the slot again.»", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"));

    expect((await confirm(scheduler1, holdId, at("2026-11-03", "14:30"))).code).toBe("HOLD_EXPIRED");
    expect(CONFIRM_MESSAGES.HOLD_EXPIRED).toBe("This hold has expired. Hold the slot again.");
    expect((await holdsOf(slot))[0].confirmed_at).toBeNull();
  });

  it("AC-HOLD-14: терапевт не підтверджує — «Only schedulers and admins can confirm holds.»", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"));

    expect((await confirm(therapist1, holdId, at("2026-11-03", "09:00"))).code).toBe("CONFIRM_FORBIDDEN");
    expect(CONFIRM_MESSAGES.CONFIRM_FORBIDDEN).toBe("Only schedulers and admins can confirm holds.");
    expect((await holdsOf(slot))[0].confirmed_at).toBeNull();
  });

  it("AC-HOLD-19: адміністратор утримує й підтверджує — «Confirmed», як у планувальника", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"), admin);

    expect(holdId).toBeTruthy();
    expect((await confirm(admin, holdId, at("2026-11-03", "09:00"))).code).toBe("OK");
    expect((await holdsOf(slot))[0].confirmed_by).toBe(admin);
  });

  it("AC-HOLD-22: о 10:00 слоту 10:00–11:00 не підтверджується, лишається «Held» до прострочення", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-04", "14:30"));

    expect((await confirm(scheduler1, holdId, at("2026-11-05", "10:00"))).code).toBe("SLOT_STARTED");
    expect(CONFIRM_MESSAGES.SLOT_STARTED).toBe("This slot has already started and cannot be confirmed.");
    const [row] = await holdsOf(slot);
    expect(row.confirmed_at).toBeNull();
    expect(row.released_at).toBeNull();
  });

  it("AC-HOLD-23: о 09:59 підтверджується — «Confirmed»", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-04", "14:30"));

    expect((await confirm(scheduler1, holdId, at("2026-11-05", "09:59"))).code).toBe("OK");
    expect((await holdsOf(slot))[0].confirmed_at).not.toBeNull();
  });

  it("AC-HOLD-27: утримання scheduler1 підтверджує scheduler2 — «Confirmed»", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"), scheduler1);

    expect((await confirm(scheduler2, holdId, at("2026-11-03", "09:00"))).code).toBe("OK");
    const [row] = await holdsOf(slot);
    expect(row.created_by).toBe(scheduler1);
    expect(row.confirmed_by).toBe(scheduler2);
  });

  it("AC-HOLD-36: друге підтвердження того самого утримання — «This hold is already confirmed.»", async () => {
    const { slot, holdId } = await heldSlot(at("2026-11-02", "14:30"));
    await confirm(scheduler1, holdId, at("2026-11-03", "09:00"));
    const [first] = await holdsOf(slot);

    expect((await confirm(scheduler2, holdId, at("2026-11-03", "09:05"))).code).toBe("ALREADY_CONFIRMED");
    expect(CONFIRM_MESSAGES.ALREADY_CONFIRMED).toBe("This hold is already confirmed.");
    const [after] = await holdsOf(slot);
    expect(after.confirmed_at).toBe(first.confirmed_at);
    expect(after.confirmed_by).toBe(scheduler1);
  });
});
