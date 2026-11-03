// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests); там 11 SQL- і 2 TS-мутанти.
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним (рядок міграції, інший тест). Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// Наше (WS8, трек B): мутанти на правила трьох AC — AC-CARD-05 (чужі дані за посиланням), AC-CARD-11 (користувач без
// ролі), AC-CARD-12 (помилки форми картки: та сама межа в базі). P1 і P2 з materials (перевірка гарнесу на profiles
// шаблону) не взято: гарнес tests/db/supabase-pglite.ts у нас з WS6, а правило P1 (колонковий grant profiles) доводить C5.
const PROFILES = "supabase/migrations/20261012000000_profiles_and_roles.sql";
const SLOT_HOLDS = "supabase/migrations/20261021150100_slot_holds.sql";
const CLIENT_CARDS = "supabase/migrations/20261023104436_client_cards.sql";
const NO_ROLE = "supabase/migrations/20261023105250_users_without_role.sql";
const CARDS_CLARIFY = "supabase/migrations/20261027073004_client_cards_clarify.sql";
const ACCESS_DB = "tests/db/client-access.test.ts";
const CARDS_DB = "tests/db/client-cards.test.ts";
const CARD_TS = "src/lib/clients/card.ts";
const CARD_UNIT = "tests/clients/card.test.ts";

export const mutants = [
  // ── AC-CARD-05: терапевт не бачить і не змінює картку чужого клієнта ─────────────────────────────────────────────
  {
    id: "C1", kind: "sql", ac: "AC-CARD-05", file: SLOT_HOLDS, tests: [ACCESS_DB],
    what: "політика clients_select послаблена до true: будь-хто з входом читає всі картки",
    find: "using ((select private.is_staff()) or private.is_client_of_current_therapist(id));",
    replace: "using (true);",
  },
  {
    id: "C2", kind: "sql", ac: "AC-CARD-05", file: CARDS_CLARIFY, tests: [ACCESS_DB],
    what: "«свій клієнт» без умови терапевта: утримання будь-якого терапевта відкриває картку",
    find: "      and s.therapist_id = (select private.current_therapist_id())\n",
    replace: "",
  },
  {
    id: "C3", kind: "sql", ac: "AC-CARD-05", file: CLIENT_CARDS, tests: [ACCESS_DB],
    what: "«картка не змінилася»: update дозволено будь-кому з входом (grant update і політика using (true))",
    find: "grant insert (name, email, client_type, date_of_birth, session_language, guardian_name, guardian_email)\n  on table public.clients to authenticated;",
    replace:
      "grant insert (name, email, client_type, date_of_birth, session_language, guardian_name, guardian_email)\n  on table public.clients to authenticated;\n" +
      "grant update on table public.clients to authenticated;\n" +
      "create policy clients_update_any on public.clients for update to authenticated using (true) with check (true);",
  },
  // ── AC-CARD-11: користувач без ролі не бачить даних клієнтів і нічого не змінює ──────────────────────────────────
  {
    id: "C4", kind: "sql", ac: "AC-CARD-11", file: NO_ROLE, tests: [ACCESS_DB],
    what: "терапевт поточного користувача без умови ролі: email терапевта в профілі без ролі відкриває його дані",
    find: "\n    and p.role = 'therapist';",
    replace: ";",
  },
  {
    id: "C5", kind: "sql", ac: "AC-CARD-11", file: PROFILES, tests: [ACCESS_DB],
    what: "колонковий grant profiles: користувач сам змінює собі role і email (самопідвищення; відгук викладача до WS7, п. 1)",
    find: "grant update (full_name) on table public.profiles to authenticated;",
    replace: "grant update (full_name, role, email) on table public.profiles to authenticated;",
  },
  {
    id: "C6", kind: "sql", ac: "AC-CARD-11", file: SLOT_HOLDS, tests: [ACCESS_DB],
    what: "політика clients_insert_staff послаблена до true: користувач без ролі створює картку",
    find: "  with check ((select private.is_staff()));",
    replace: "  with check (true);",
  },
  // ── AC-CARD-12: та сама межа, що й у формі, — остання лінія в базі ──────────────────────────────────────────────
  {
    id: "C7", kind: "sql", ac: "AC-CARD-12", file: CLIENT_CARDS, tests: [CARDS_DB],
    what: "тригер дати народження: > → >= — сьогоднішня дата вже «в майбутньому» (припущення PM: сьогодні — коректно)",
    find: "if new.date_of_birth > (now() at time zone 'America/Los_Angeles')::date then",
    replace: "if new.date_of_birth >= (now() at time zone 'America/Los_Angeles')::date then",
  },
  {
    id: "C8", kind: "sql", ac: "AC-CARD-12", file: CLIENT_CARDS, tests: [CARDS_DB],
    what: "clients_contact_by_type: дитина без мови сеансів приймається («Select a session language.»)",
    find: "      and session_language is not null\n",
    replace: "",
  },
  {
    id: "C9", kind: "sql", ac: "AC-CARD-12", file: SLOT_HOLDS, tests: [CARDS_DB],
    what: "clients_name_not_blank послаблене до true: картка з порожнім ім'ям («Enter the client's name.»)",
    find: "constraint clients_name_not_blank check (btrim(name) <> '')",
    replace: "constraint clients_name_not_blank check (true)",
  },
  // ── AC-CARD-12, TS: ручні мутанти на межах з AC (повний перебір — npm run mutation:ts, Stryker) ─────────────────
  {
    id: "T1", kind: "ts", ac: "AC-CARD-12", file: CARD_TS, tests: [CARD_UNIT],
    what: "isBirthDate: <= → < — дата народження, що дорівнює сьогоднішній, відхиляється",
    find: "value <= today",
    replace: "value < today",
  },
  {
    id: "T2", kind: "ts", ac: "AC-CARD-12", file: CARD_TS, tests: [CARD_UNIT],
    what: "не всі помилки одразу: після порожнього імені дитини перевірка зупиняється",
    find: '  if (type === "child" && !name) errors.push("CHILD_NAME");',
    replace: '  if (type === "child" && !name) return { ok: false, errors: ["CHILD_NAME"] };',
  },
];

// Приклади з демо (інша схема — у вашому репо цих файлів немає, тож не розкоментовуйте як є):
//
// SQL, межа з AC — діапазон напіввідкритий, останній день заявки не рахується:
//   { id: "L2", kind: "sql", ac: "AC-LEAVE-11", file: RULES, tests: [LEAVE_DB],
//     what: "перетин: діапазон НОВОЇ заявки напіввідкритий [початок, кінець)",
//     find: "pg_catalog.daterange(p_start_date, p_end_date, '[]')",
//     replace: "pg_catalog.daterange(p_start_date, p_end_date, '[)')" },
//
// SQL, політика послаблена до true (а не видалена: без політики RLS забороняє все, і тест відмови лишився б зеленим):
//   { id: "L5", kind: "sql", ac: "передумова AC-LEAVE-04/10", file: LEAVE, tests: [LEAVE_DB],
//     what: "blocked_days: insert дозволено будь-кому з входом, а не лише адміністратору",
//     find: "on public.blocked_days for insert to authenticated\n  with check ((select private.current_app_role()) = 'admin');",
//     replace: "on public.blocked_days for insert to authenticated\n  with check (true);" },
//
// Еквівалентний мутант — лише з reason, що посилається на рядок, який робить його зайвим:
//   { id: "L6", kind: "sql", ac: "AC-LEAVE-06/07", file: RECORDS, tests: [LEAVE_DB],
//     what: "політика рішень: прибрано role = 'manager'", expect: "survive",
//     reason: "еквівалентний: з 20261018000000_manager_helpers_require_role.sql private.is_division_manager() сама " +
//       "перевіряє current_app_role() = 'manager'", find: "…", replace: "…" },
