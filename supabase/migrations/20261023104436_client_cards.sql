-- Зріз 2: картка клієнта з анкети — дорослий або дитина з опікуном (openspec/specs/client-cards; план —
-- openspec/changes/impl-client-cards/design.md, «Дані й RLS»). Уточнення зрізу 1 (openspec/specs/clients): правило
-- коректного email PM (AC-HOLD-39) і ім'я без пробілів по краях (AC-HOLD-41).
-- Застосовану міграцію 20261021150100_slot_holds.sql не змінюємо: нові колонки, constraint-и, тригер і GRANT.
-- Політики clients_select і clients_insert_staff не змінюються: читання — планувальник, адміністратор і свій терапевт
-- (20261023084029), створення — лише планувальник і адміністратор (AC-CARD-06). update і delete — без GRANT і без
-- політик: редагування картки поза зрізом, тож картка не змінюється (AC-CARD-05, AC-CARD-07, AC-CARD-11).

-- ── Колонки картки ──────────────────────────────────────────────────────────
-- Наявні картки зрізу 1 стають «Adult», інших полів у них немає («Not provided» на сторінці; припущення PM).
alter table public.clients
  add column client_type      text not null default 'adult',
  add column date_of_birth    date,
  add column session_language text,
  add column guardian_name    text,
  add column guardian_email   text;

-- У дитини власного email немає — контакт є email опікуна (AC-CARD-02); unique (email) пропускає кілька null.
alter table public.clients alter column email drop not null;

-- ── Правила картки ──────────────────────────────────────────────────────────
-- Коректний email (правило PM): рівно один «@», непорожня частина до нього, крапка в частині після «@», без пробілів.
alter table public.clients drop constraint clients_email_format;

alter table public.clients
  add constraint clients_type_check check (client_type in ('adult', 'child')),
  add constraint clients_language_check check (session_language in ('English', 'Spanish')),
  -- Дорослий — власний email, без опікуна; дитина — без власного email, з опікуном і всіма полями анкети
  -- (AC-CARD-01, AC-CARD-02, AC-CARD-03). Дату й мову дорослого вимагає повна форма: швидка форма зрізу 1 їх не має.
  add constraint clients_contact_by_type check (
    (client_type = 'adult' and email is not null and guardian_name is null and guardian_email is null)
    or (
      client_type = 'child'
      and email is null
      and guardian_name is not null
      and guardian_email is not null
      and date_of_birth is not null
      and session_language is not null
    )
  ),
  add constraint clients_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]*\.[^@[:space:]]*$'),
  add constraint clients_name_trimmed check (name = btrim(name)),
  add constraint clients_guardian_name_valid check (guardian_name = btrim(guardian_name) and guardian_name <> ''),
  add constraint clients_guardian_email_normalized check (guardian_email = lower(btrim(guardian_email))),
  add constraint clients_guardian_email_format
    check (guardian_email ~ '^[^@[:space:]]+@[^@[:space:]]*\.[^@[:space:]]*$');

-- ── Дата народження не пізніше за сьогодні (America/Los_Angeles) ───────────────────────────────────
-- Check-обмеження перевіряється лише під час запису й не має залежати від now(), тож — тригер; код помилки 23514,
-- як у check. security invoker: функція лише читає поточний час.
create or replace function private.clients_birth_date_not_in_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'date_of_birth % is later than today', new.date_of_birth using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.clients_birth_date_not_in_future() from public, anon, authenticated;

create trigger clients_birth_date_not_in_future
  before insert or update of date_of_birth on public.clients
  for each row execute function private.clients_birth_date_not_in_future();

-- ── Права (GRANT) ───────────────────────────────────────────────────────────
-- Колонковий grant: id, created_by і created_at користувач не передає (AC-CARD-01, AC-CARD-02).
grant insert (name, email, client_type, date_of_birth, session_language, guardian_name, guardian_email)
  on table public.clients to authenticated;
