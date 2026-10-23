// Що терапевт бачить напряму через базу (Data API з його токеном), а не лише на сторінці /schedule.
// RLS політики holds_select і clients_select (через private.is_client_of_current_therapist): терапевт бачить лише
// утримання й сеанси власних слотів, і лише підтверджені або ще активні. Прострочені й звільнені утримання та їхніх
// клієнтів бачать лише планувальник і адміністратор (AC-HOLD-20, AC-HOLD-21).
// Політика рахує прострочення від now(), тож тут зсуваємо дані відносно now(), а не годинник.
import { beforeAll, describe, expect, it } from "vitest";
import { at } from "../holds/fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let therapist1: string;
let therapist2: string;
let scheduler1: string;

const emailsSeenBy = async (userId: string) =>
  (await t.asUser<{ email: string }>(userId, "select email from public.clients order by email")).map((r) => r.email);

const holdClientsSeenBy = async (userId: string) =>
  (
    await t.asUser<{ email: string }>(
      userId,
      // left join: якщо RLS покаже утримання, але сховає його клієнта, тут буде null.
      "select c.email from public.holds as h left join public.clients as c on c.id = h.client_id order by c.email",
    )
  ).map((r) => r.email);

const holdsSeenBy = async (userId: string) =>
  (await t.asUser<{ id: string }>(userId, "select id from public.holds")).length;

beforeAll(async () => {
  t = await createTestDb();
  therapist1 = t.users["therapist1@example.test"];
  therapist2 = t.users["therapist2@example.test"];
  scheduler1 = t.users["scheduler1@example.test"];

  const [{ id: active }, { id: confirmed }, { id: expired }, { id: released }] = await t.asService<{ id: string }>(
    `insert into public.clients (name, email) values
       ('Active Client', 'active@example.test'), ('Confirmed Client', 'confirmed@example.test'),
       ('Expired Client', 'expired@example.test'), ('Released Client', 'released@example.test')
     returning id`,
  );
  const slot = async (time: string) =>
    (
      await t.asService<{ id: string }>(
        `select s.id from public.slots as s join public.therapists as th on th.id = s.therapist_id
         where th.email = 'therapist1@example.test' and s.starts_at = $1`,
        [at("2026-12-14", time)],
      )
    )[0].id;
  const [s10, s11, s12, s13] = [await slot("10:00"), await slot("11:00"), await slot("12:00"), await slot("13:00")];

  // Утримання на слотах therapist1 у майбутньому (2026-12-14), створені відносно now():
  await t.asService(
    `insert into public.holds (slot_id, client_id, created_at, expires_at, confirmed_at, released_at) values
       ($1, $5, now() - interval '1 hour',  now() - interval '1 hour'  + interval '1440 minutes', null, null),
       ($2, $6, now() - interval '30 hours', now() - interval '30 hours' + interval '1440 minutes',
            now() - interval '29 hours', null),
       ($3, $7, now() - interval '25 hours', now() - interval '25 hours' + interval '1440 minutes', null, null),
       ($4, $8, now() - interval '26 hours', now() - interval '26 hours' + interval '1440 minutes', null,
            now() - interval '1 hour')`,
    [s10, s11, s12, s13, active, confirmed, expired, released],
  );
}, 60_000);

describe("видимість утримань і клієнтів для терапевта (RLS)", () => {
  it("AC-HOLD-21: терапевт напряму через базу не бачить прострочених і звільнених утримань своїх слотів та їхніх клієнтів", async () => {
    expect(await holdsSeenBy(therapist1)).toBe(2);
    expect(await holdClientsSeenBy(therapist1)).toEqual(["active@example.test", "confirmed@example.test"]);
    expect(await emailsSeenBy(therapist1)).toEqual(["active@example.test", "confirmed@example.test"]);
    // Дані не змінились: усі чотири утримання на місці, їх бачить планувальник.
    expect((await t.asService<{ n: number }>("select count(*)::int as n from public.holds"))[0].n).toBe(4);
  });

  it("AC-HOLD-20: планувальник бачить усі утримання, зокрема прострочене, і всіх клієнтів", async () => {
    expect(await holdsSeenBy(scheduler1)).toBe(4);
    expect(await emailsSeenBy(scheduler1)).toEqual([
      "active@example.test",
      "confirmed@example.test",
      "expired@example.test",
      "released@example.test",
    ]);
  });

  it("AC-HOLD-09: інший терапевт не бачить ні утримань слотів therapist1, ні їхніх клієнтів", async () => {
    expect(await holdsSeenBy(therapist2)).toBe(0);
    expect(await emailsSeenBy(therapist2)).toEqual([]);
  });

  it("AC-HOLD-09: відвідувач без входу не читає ні утримань, ні клієнтів", async () => {
    await expect(t.asAnon("select id from public.holds")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select id from public.clients")).rejects.toThrow(/permission denied/);
  });
});
