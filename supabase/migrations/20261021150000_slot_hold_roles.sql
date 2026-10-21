-- Ролі зрізу 1 (requirements/product.md, «Користувачі й ролі»; openspec/specs/slot-holds — «Хто утримує й підтверджує»):
-- admin, scheduler, therapist замість member/admin шаблону.
-- Порядок із заголовка 20261012000000_profiles_and_roles.sql: старий constraint → наявні дані → default → новий constraint.
-- Без нового default тригер on_auth_user_created вставив би 'member', і кожен createUser (npm run users:demo) упав би.

alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'therapist' where role = 'member';

-- Новий користувач без явної ролі отримує найменші права; роль ставить users:demo (service_role).
alter table public.profiles alter column role set default 'therapist';

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'scheduler', 'therapist'));
