-- Терапевт напряму через базу (Data API з його токеном) бачить лише підтверджені або ще активні утримання власних
-- слотів і лише клієнтів цих утримань. Прострочені й звільнені утримання та їхніх клієнтів бачать лише планувальник і
-- адміністратор (AC-HOLD-20, AC-HOLD-21; матриця прав: терапевт бачить лише пов'язаних з ним клієнтів).
-- Раніше сторінка /schedule ховала такі утримання, а база віддавала їх разом з іменем і email клієнта.
-- Застосовану міграцію 20261021150100_slot_holds.sql не змінюємо: нова версія функції й політики.
-- Прострочення рахується від now(), як і статус «Expired» на сторінках (без cron).

-- «Підтверджене або ще активне» — та сама умова, що й у функції утримання (AC-HOLD-03, AC-HOLD-26).
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
      and (h.confirmed_at is not null or (h.released_at is null and now() < h.expires_at))
  );
$$;

drop policy holds_select on public.holds;

create policy holds_select
  on public.holds
  for select
  to authenticated
  using (
    (select private.is_staff())
    or (
      (holds.confirmed_at is not null or (holds.released_at is null and now() < holds.expires_at))
      and exists (
        select 1
        from public.slots as s
        where s.id = holds.slot_id
          and s.therapist_id = (select private.current_therapist_id())
      )
    )
  );
