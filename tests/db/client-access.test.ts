// Хто бачить картки клієнтів напряму через базу (Data API з токеном користувача), а не лише на сторінках /clients:
// RLS clients_select — планувальник і адміністратор бачать усіх, терапевт — лише своїх клієнтів («Held» до прострочення
// або «Confirmed» на його слотах); update і delete — без GRANT; anon — без жодних прав; користувач без ролі нічого не
// бачить і терапевтом не стає (міграції 20261023084029, 20261023104436, 20261023105250).
// Політика рахує прострочення від now(), тож утримання зсуваємо відносно now(), а слоти — у майбутньому.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NO_ACCESS_TO_CLIENT, NO_CLIENTS_YET } from "@/lib/clients/card";
import { NO_ROLE_MESSAGE } from "@/lib/holds/types";
import { at } from "../holds/fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let therapist1: string;
let therapist2: string;
let newuser1: string;
let client6: string;
let client7: string;
let client9: string;
let t1At10: string;
let t1At11: string;
let t2At10: string;

type Card = {
  name: string;
  client_type: string;
  date_of_birth: string | null;
  session_language: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
};
const CARD_SQL = `select name, client_type, to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth, session_language,
  email, guardian_name, guardian_email from public.clients`;

const cardsSeenBy = (userId: string) => t.asUser<Card>(userId, `${CARD_SQL} order by name`);
const cardById = (userId: string, id: string) => t.asUser<Card>(userId, `${CARD_SQL} where id = $1`, [id]);
const snapshot = () => t.asService<Card>(`${CARD_SQL} order by name`);

async function slotOf(therapistEmail: string, time: string): Promise<string> {
  const [row] = await t.asService<{ id: string }>(
    `select s.id from public.slots as s join public.therapists as th on th.id = s.therapist_id
     where th.email = $1 and s.starts_at = $2`,
    [therapistEmail, at("2026-12-14", time)],
  );
  return row.id;
}

/** Утримання, створене `hoursAgo` годин тому: до 24 — «Held», від 24 — «Expired»; `confirmed` — сеанс «Confirmed». */
async function holdFor(slot: string, client: string, hoursAgo: number, confirmed = false) {
  await t.asService(
    `insert into public.holds (slot_id, client_id, created_at, expires_at, confirmed_at)
     values ($1, $2, now() - make_interval(hours => $3), now() - make_interval(hours => $3) + interval '1440 minutes',
             case when $4 then now() - make_interval(hours => $3) + interval '10 minutes' end)`,
    [slot, client, hoursAgo, confirmed],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  therapist1 = t.users["therapist1@example.test"];
  therapist2 = t.users["therapist2@example.test"];
  newuser1 = t.users["newuser1@example.test"];
  [{ id: client6 }, { id: client7 }, { id: client9 }] = await t.asService<{ id: string }>(
    `insert into public.clients
       (client_type, name, date_of_birth, session_language, email, guardian_name, guardian_email) values
       ('adult', 'Client Six', '1990-05-14', 'English', 'client6@example.test', null, null),
       ('child', 'Client Seven', '2015-03-02', 'Spanish', null, 'Guardian Seven', 'guardian7@example.test'),
       ('adult', 'Client Nine', '1985-07-01', 'English', 'client9@example.test', null, null)
     returning id`,
  );
  [t1At10, t1At11, t2At10] = [
    await slotOf("therapist1@example.test", "10:00"),
    await slotOf("therapist1@example.test", "11:00"),
    await slotOf("therapist2@example.test", "10:00"),
  ];
}, 60_000);

beforeEach(async () => {
  await t.asService("delete from public.holds");
});

describe("картки клієнтів для терапевта (RLS clients_select)", () => {
  it("AC-CARD-04: therapist1 бачить картки client6 («Held») і client7 («Confirmed») з усіма даними анкети, без client9", async () => {
    await holdFor(t1At10, client6, 1);
    await holdFor(t1At11, client7, 30, true);
    await holdFor(t2At10, client9, 1);

    expect(await cardsSeenBy(therapist1)).toEqual([
      {
        name: "Client Seven",
        client_type: "child",
        date_of_birth: "2015-03-02",
        session_language: "Spanish",
        email: null,
        guardian_name: "Guardian Seven",
        guardian_email: "guardian7@example.test",
      },
      {
        name: "Client Six",
        client_type: "adult",
        date_of_birth: "1990-05-14",
        session_language: "English",
        email: "client6@example.test",
        guardian_name: null,
        guardian_email: null,
      },
    ]);
  });

  it("AC-CARD-05: client9 — свій лише для therapist2; therapist1 за посиланням не отримує даних і не змінює картку", async () => {
    await holdFor(t2At10, client9, 1);
    const before = await snapshot();

    expect(await cardById(therapist2, client9)).toHaveLength(1);
    expect(await cardById(therapist1, client9)).toEqual([]); // сторінка покаже «You don't have access to this client.»
    expect(NO_ACCESS_TO_CLIENT).toBe("You don't have access to this client.");
    // Змінити чи видалити картку не можна: GRANT update / delete немає.
    await expect(
      t.asUser(therapist1, "update public.clients set name = 'Changed' where id = $1", [client9]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asUser(therapist1, "delete from public.clients where id = $1", [client9])).rejects.toThrow(
      /permission denied/,
    );
    expect(await snapshot()).toEqual(before);
  });

  it("AC-CARD-08: утримання client6 у therapist1 прострочене, інших немає — client6 немає в списку й за посиланням", async () => {
    await holdFor(t1At10, client6, 25);

    expect((await cardsSeenBy(therapist1)).map((c) => c.name)).not.toContain("Client Six");
    expect(await cardById(therapist1, client6)).toEqual([]);
    // Для планувальника картка й прострочене утримання лишаються.
    expect(await cardById(t.users["scheduler1@example.test"], client6)).toHaveLength(1);
  });

  it("AC-CARD-09: у therapist2 немає «Held» і «Confirmed» — жодної картки, сторінка показує повідомлення PM", async () => {
    await holdFor(t2At10, client9, 30); // лише прострочене
    await holdFor(t1At10, client6, 1); // у іншого терапевта

    expect(await cardsSeenBy(therapist2)).toEqual([]);
    expect(NO_CLIENTS_YET).toBe("No clients yet. Clients appear here when a scheduler holds a slot with you.");
  });
});

describe("без входу й без ролі", () => {
  it("AC-CARD-07: відвідувач без входу (anon) не читає карток і утримань, не створює карток, картки не змінились", async () => {
    await holdFor(t1At10, client6, 1);
    const before = await snapshot();

    // Сторінки /clients, /clients/[id] і /holds перенаправляють на /login (proxy і requireViewer); база — друга лінія.
    await expect(t.asAnon("select id from public.clients")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select id from public.holds")).rejects.toThrow(/permission denied/);
    await expect(
      t.asAnon("insert into public.clients (name, email) values ('Anon', 'anon@example.test')"),
    ).rejects.toThrow(/permission denied/);
    expect(await snapshot()).toEqual(before);
  });

  it("AC-CARD-11: newuser1 без ролі не бачить жодних даних, не створює картку й не стає терапевтом", async () => {
    await holdFor(t2At10, client9, 1);
    const before = await snapshot();

    const [profile] = await t.asUser<{ role: string | null }>(newuser1, "select role from public.profiles");
    expect(profile.role).toBeNull(); // застосунок покаже лише NO_ROLE_MESSAGE
    expect(NO_ROLE_MESSAGE).toBe("Your account has no access yet. Contact an administrator.");
    expect(await cardsSeenBy(newuser1)).toEqual([]);
    expect(await cardById(newuser1, client6)).toEqual([]);
    expect(await t.asUser(newuser1, "select id from public.holds")).toEqual([]);
    await expect(
      t.asUser(newuser1, "insert into public.clients (name, email) values ('Client Ten', 'client10@example.test')"),
    ).rejects.toThrow(/row-level security/);

    // Навіть email терапевта в профілі без ролі не дає його слотів, утримань і клієнтів.
    await t.asService("update public.profiles set email = 'therapist2@example.test' where id = $1", [newuser1]);
    try {
      expect(await t.asUser(newuser1, "select id from public.slots limit 1")).toEqual([]);
      expect(await cardsSeenBy(newuser1)).toEqual([]);
    } finally {
      await t.asService("update public.profiles set email = 'newuser1@example.test' where id = $1", [newuser1]);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("AC-CARD-11: новий користувач Auth отримує профіль без ролі, а не роль терапевта", async () => {
    await t.db.exec("begin; set local role supabase_auth_admin;");
    await t.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      "b0000000-0000-0000-0000-000000000001",
      "newuser2@example.test",
      { full_name: "New User Two" },
    ]);
    await t.db.exec("commit");

    const [profile] = await t.asService<{ role: string | null }>(
      "select role from public.profiles where email = 'newuser2@example.test'",
    );
    expect(profile.role).toBeNull();
  });
});
