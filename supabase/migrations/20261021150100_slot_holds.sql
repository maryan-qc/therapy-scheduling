-- Зріз 1: терапевти, слоти, картки клієнтів і утримання (openspec/specs/slot-holds, openspec/specs/clients;
-- план — openspec/changes/impl-slot-hold/design.md).
--
-- Статус утримання не зберігається: Held / Confirmed / Expired рахує читання з expires_at = created_at + 1440 хвилин,
-- тож «слот знову вільний» без фонової задачі (AC-HOLD-05, AC-HOLD-06).
-- Утримання створюють і підтверджують лише функції наступної міграції (одна транзакція з перевірками), тому
-- authenticated має на holds тільки select.

-- ── Терапевти ───────────────────────────────────────────────────────────────
create table public.therapists (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint therapists_email_key unique (email),
  constraint therapists_email_normalized check (email = lower(btrim(email))),
  constraint therapists_name_not_blank check (btrim(name) <> '')
);

comment on table public.therapists is
  'Терапевт практики. Користувач-терапевт — профіль із тим самим email. У зрізі 1 — початкові дані цієї міграції.';

-- ── Слоти доступності ───────────────────────────────────────────────────────
-- 60 хвилин від початку години (припущення PM): слоти одного терапевта не мають спільної хвилини.
create table public.slots (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists (id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  constraint slots_therapist_start_key unique (therapist_id, starts_at),
  constraint slots_sixty_minutes check (ends_at = starts_at + interval '60 minutes'),
  constraint slots_on_the_hour check (extract(epoch from starts_at)::bigint % 3600 = 0)
);

create index slots_starts_at_idx on public.slots (starts_at);

-- ── Картки клієнтів ─────────────────────────────────────────────────────────
-- Email зберігається малими літерами без пробілів по краях, тож unique ловить і « Client1@Example.TEST »
-- (AC-HOLD-16, AC-HOLD-34, AC-HOLD-35).
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint clients_email_key unique (email),
  constraint clients_name_not_blank check (btrim(name) <> ''),
  constraint clients_email_normalized check (email = lower(btrim(email))),
  constraint clients_email_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

-- ── Утримання ───────────────────────────────────────────────────────────────
-- released_at ставить функція утримання, коли звільняє прострочене утримання слоту перед новим.
create table public.holds (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.slots (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete restrict,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null,
  expires_at   timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  released_at  timestamptz,
  constraint holds_lasts_1440_minutes check (expires_at = created_at + interval '1440 minutes'),
  constraint holds_confirmed_before_expiry check (confirmed_at is null or confirmed_at < expires_at),
  constraint holds_confirmed_not_released check (confirmed_at is null or released_at is null)
);

-- Не більше одного відкритого утримання чи сеансу на слот (припущення PM; AC-HOLD-03, AC-HOLD-04, AC-HOLD-17).
create unique index holds_one_open_per_slot on public.holds (slot_id) where released_at is null;
create index holds_client_idx on public.holds (client_id);

-- ── Хелпери (security definer: читають таблиці в обхід RLS, тож політики не зациклюються) ─────
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('scheduler', 'admin'), false);
$$;

-- Терапевт поточного користувача — за email профілю (email профілю користувач змінити не може: GRANT лише full_name).
create or replace function private.current_therapist_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.therapists as t
  join public.profiles as p on p.email = t.email
  where p.id = (select auth.uid());
$$;

-- Терапевт бачить картки лише своїх клієнтів: тих, хто має утримання чи сеанс на його слотах.
create or replace function private.is_client_of_current_therapist(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.holds as h
    join public.slots as s on s.id = h.slot_id
    where h.client_id = p_client_id
      and s.therapist_id = (select private.current_therapist_id())
  );
$$;

revoke execute on function private.is_staff() from public, anon;
revoke execute on function private.current_therapist_id() from public, anon;
revoke execute on function private.is_client_of_current_therapist(uuid) from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.current_therapist_id() to authenticated;
grant execute on function private.is_client_of_current_therapist(uuid) to authenticated;

-- ── RLS і права (GRANT) ─────────────────────────────────────────────────────
alter table public.therapists enable row level security;
alter table public.slots enable row level security;
alter table public.clients enable row level security;
alter table public.holds enable row level security;

revoke all on table public.therapists from anon, authenticated;
revoke all on table public.slots from anon, authenticated;
revoke all on table public.clients from anon, authenticated;
revoke all on table public.holds from anon, authenticated;

grant select on table public.therapists to authenticated;
grant select on table public.slots to authenticated;
grant select on table public.clients to authenticated;
-- Колонковий grant: created_by ставить default auth.uid(), користувач його не передає.
grant insert (name, email) on table public.clients to authenticated;
grant select on table public.holds to authenticated;
-- update / delete для authenticated свідомо не видаємо: утримання змінюють лише функції, картки — поза зрізом.

grant select, insert, update, delete on table public.therapists to service_role;
grant select, insert, update, delete on table public.slots to service_role;
grant select, insert, update, delete on table public.clients to service_role;
grant select, insert, update, delete on table public.holds to service_role;

-- Матриця прав (requirements/product.md): планувальник і адміністратор — усе; терапевт — лише власне.
create policy therapists_select
  on public.therapists
  for select
  to authenticated
  using ((select private.is_staff()) or id = (select private.current_therapist_id()));

create policy slots_select
  on public.slots
  for select
  to authenticated
  using ((select private.is_staff()) or therapist_id = (select private.current_therapist_id()));

create policy clients_select
  on public.clients
  for select
  to authenticated
  using ((select private.is_staff()) or private.is_client_of_current_therapist(id));

create policy clients_insert_staff
  on public.clients
  for insert
  to authenticated
  with check ((select private.is_staff()));

create policy holds_select
  on public.holds
  for select
  to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1
      from public.slots as s
      where s.id = holds.slot_id
        and s.therapist_id = (select private.current_therapist_id())
    )
  );

-- ── Початкові дані зрізу 1 (припущення PM: терапевти й доступність — сид) ──────────────────────
-- Сид у хмарі вже виконано в день 0, тож дані — тут, ідемпотентно.
-- Слоти пн–пт 09:00–17:00 за America/Los_Angeles; у therapist1 немає слотів 2026-11-06 (як в AC-HOLD-24).
insert into public.therapists (email, name)
values
  ('therapist1@example.test', 'Therapist One'),
  ('therapist2@example.test', 'Therapist Two')
on conflict (email) do nothing;

insert into public.slots (therapist_id, starts_at, ends_at)
select
  t.id,
  ((d::date + make_time(h, 0, 0)) at time zone 'America/Los_Angeles'),
  ((d::date + make_time(h, 0, 0)) at time zone 'America/Los_Angeles') + interval '60 minutes'
from public.therapists as t
cross join generate_series(timestamp '2026-10-19', timestamp '2026-12-31', interval '1 day') as d
cross join generate_series(9, 16) as h
where extract(isodow from d) between 1 and 5
  and not (t.email = 'therapist1@example.test' and d::date = date '2026-11-06')
on conflict (therapist_id, starts_at) do nothing;
