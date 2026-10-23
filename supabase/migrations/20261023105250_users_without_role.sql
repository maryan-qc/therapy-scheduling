-- Зріз 2: користувач, який увійшов, але не має ролі, бачить лише повідомлення «Your account has no access yet. Contact an
-- administrator.» і жодних даних клієнтів (AC-CARD-11; правило про ролі в матриці прав requirements/product.md).
-- План — openspec/changes/impl-client-cards/design.md, «Ролі».
--
-- Набір ролей той самий (admin, scheduler, therapist), але роль тепер може бути відсутня (null). Порядок drop-first із
-- заголовка 20261012000000_profiles_and_roles.sql: старий constraint → дані → default → новий constraint.

-- 1) Старий constraint не пропустив би null.
alter table public.profiles drop constraint profiles_role_check;

-- 2) Дані: наявні ролі не змінюємо — усі користувачі зрізу 1 мають роль із сиду (npm run users:demo).

-- 3) Новий користувач Auth отримує профіль без ролі, а не 'therapist': тригер on_auth_user_created не передає role,
--    тож діє default. Раніше default 'therapist' дав би йому розклад терапевта. Роль ставить лише service_role.
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;

-- 4) Новий набір: роль із переліку або відсутня.
alter table public.profiles
  add constraint profiles_role_check check (role is null or role in ('admin', 'scheduler', 'therapist'));

-- Терапевт поточного користувача — лише для ролі therapist: користувач без ролі, чий email збігся б з email терапевта,
-- не бачить його слотів, утримань і клієнтів (AC-CARD-11). is_staff() для null уже дає false.
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
  where p.id = (select auth.uid()); -- MUTATION (тимчасово, буде revert): без умови ролі — AC-CARD-11 має впасти.
$$;
