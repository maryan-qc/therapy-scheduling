// Статус перевірки страхування напряму через базу (Data API з токеном користувача), а не лише на сторінці картки:
// позначає лише планувальник чи адміністратор функцією set_insurance_status; прямого update немає ні в кого; терапевт
// бачить статус лише своїх клієнтів; anon — нічого (міграція 20261106170000_insurance_status.sql).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let scheduler1: string;
let scheduler2: string;
let admin1: string;
let therapist1: string;
let therapist2: string;
let client6: string;
let client7: string;

const statusOf = async (clientId: string) =>
  (await t.asService<{ insurance_status: string }>("select insurance_status from public.clients where id = $1", [clientId]))[0]
    .insurance_status;
const seenBy = (userId: string, clientId: string) =>
  t.asUser<{ insurance_status: string }>(userId, "select insurance_status from public.clients where id = $1", [clientId]);
const setStatus = async (userId: string, clientId: string, status: string) =>
  (await t.asUser<{ result: { code: string } }>(userId, "select public.set_insurance_status($1, $2) as result", [clientId, status]))[0]
    .result.code;

/** client6 — свій клієнт therapist1: утримання «Held» на його слоті, що ще не почався. */
async function makeClient6OfTherapist1() {
  await t.asService(
    `insert into public.holds (slot_id, client_id, created_at, expires_at)
     select s.id, $1, now(), now() + interval '24 hours'
     from public.slots as s join public.therapists as th on th.id = s.therapist_id
     where th.email = 'therapist1@example.test' and s.starts_at > now() + interval '2 days'
     order by s.starts_at limit 1`,
    [client6],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  scheduler1 = t.users["scheduler1@example.test"];
  scheduler2 = t.users["scheduler2@example.test"];
  admin1 = t.users["admin1@example.test"];
  therapist1 = t.users["therapist1@example.test"];
  therapist2 = t.users["therapist2@example.test"];
  [{ id: client6 }, { id: client7 }] = await t.asService<{ id: string }>(
    `insert into public.clients
       (client_type, name, date_of_birth, session_language, email, guardian_name, guardian_email) values
       ('adult', 'Client Six', '1990-05-14', 'English', 'client6@example.test', null, null),
       ('child', 'Client Seven', '2015-03-02', 'Spanish', null, 'Guardian Seven', 'guardian7@example.test')
     returning id`,
  );
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
  await t.asService("update public.clients set insurance_status = 'not_set'");
});

describe("статус перевірки страхування (set_insurance_status, RLS clients_select)", () => {
  it("AC-INS-01: нова картка й картка зрізу 1 без позначки — «Not set»", async () => {
    const [{ id: slice1 }] = await t.asUser<{ id: string }>(
      scheduler1,
      "insert into public.clients (name, email) values ('Client One', 'client1@example.test') returning id",
    );
    expect(await statusOf(client6)).toBe("not_set");
    expect(await statusOf(slice1)).toBe("not_set");
    expect(await seenBy(scheduler1, client6)).toEqual([{ insurance_status: "not_set" }]);
  });

  it("AC-INS-02: scheduler1 позначає «Verified» — статус збережено й видно при повторному читанні", async () => {
    expect(await setStatus(scheduler1, client6, "verified")).toBe("OK");
    expect(await seenBy(scheduler1, client6)).toEqual([{ insurance_status: "verified" }]);
  });

  it("AC-INS-03: admin1 змінює «Verified» на «Private pay» — scheduler2 бачить «Private pay»", async () => {
    await setStatus(scheduler1, client7, "verified");
    expect(await setStatus(admin1, client7, "private_pay")).toBe("OK");
    expect(await seenBy(admin1, client7)).toEqual([{ insurance_status: "private_pay" }]);
    expect(await seenBy(scheduler2, client7)).toEqual([{ insurance_status: "private_pay" }]);
  });

  it("AC-INS-04: therapist1 бачить «Not accepted» свого client6; therapist2 картки client6 не отримує", async () => {
    await makeClient6OfTherapist1();
    await setStatus(scheduler1, client6, "not_accepted");
    expect(await seenBy(therapist1, client6)).toEqual([{ insurance_status: "not_accepted" }]);
    expect(await seenBy(therapist2, client6)).toEqual([]);
  });

  it("AC-INS-05: therapist1 напряму (RPC і update) не змінює статус свого client6 — лишається «Not accepted»", async () => {
    await makeClient6OfTherapist1();
    await setStatus(scheduler1, client6, "not_accepted");

    expect(await setStatus(therapist1, client6, "verified")).toBe("INSURANCE_FORBIDDEN");
    await expect(
      t.asUser(therapist1, "update public.clients set insurance_status = 'verified' where id = $1", [client6]),
    ).rejects.toThrow(/permission denied/);
    // І персонал напряму, повз функцію, не змінює: GRANT update немає ні в кого.
    await expect(
      t.asUser(scheduler1, "update public.clients set insurance_status = 'verified' where id = $1", [client6]),
    ).rejects.toThrow(/permission denied/);
    expect(await seenBy(scheduler1, client6)).toEqual([{ insurance_status: "not_accepted" }]);
  });

  it("AC-INS-05: «Not set» повернути не можна, невідоме значення відхилено — статус не змінився", async () => {
    await setStatus(scheduler1, client6, "verified");
    expect(await setStatus(scheduler1, client6, "not_set")).toBe("INVALID_STATUS");
    expect(await setStatus(admin1, client6, "paid")).toBe("INVALID_STATUS");
    expect(await statusOf(client6)).toBe("verified");
  });

  it("AC-INS-06: без входу (anon) ні читання картки, ні зміни статусу — «Verified» лишається", async () => {
    await setStatus(scheduler1, client6, "verified");
    await expect(t.asAnon("select insurance_status from public.clients where id = $1", [client6])).rejects.toThrow(
      /permission denied/,
    );
    await expect(t.asAnon("select public.set_insurance_status($1, 'not_accepted')", [client6])).rejects.toThrow(
      /permission denied/,
    );
    expect(await seenBy(scheduler1, client6)).toEqual([{ insurance_status: "verified" }]);
  });
});
