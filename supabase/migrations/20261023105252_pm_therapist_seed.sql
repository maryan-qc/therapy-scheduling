-- Акаунт терапевта для приймання зрізу 2 PM (pm-therapist@example.test, supabase/demo-users.json): терапевт і його
-- доступність — початкові дані, як у зрізі 1 (припущення PM: терапевти та їхня доступність — сид).
-- Слоти пн–пт 09:00–17:00 за America/Los_Angeles, з 2026-10-26 до кінця року; ідемпотентно.
insert into public.therapists (email, name)
values ('pm-therapist@example.test', 'PM Therapist')
on conflict (email) do nothing;

insert into public.slots (therapist_id, starts_at, ends_at)
select
  t.id,
  ((d::date + make_time(h, 0, 0)) at time zone 'America/Los_Angeles'),
  ((d::date + make_time(h, 0, 0)) at time zone 'America/Los_Angeles') + interval '60 minutes'
from public.therapists as t
cross join generate_series(timestamp '2026-10-26', timestamp '2026-12-31', interval '1 day') as d
cross join generate_series(9, 16) as h
where t.email = 'pm-therapist@example.test'
  and extract(isodow from d) between 1 and 5
on conflict (therapist_id, starts_at) do nothing;
