-- Розклад терапевта: імена клієнтів утримань одним викликом за списком id, а не читанням таблиці clients.
-- Сторінка /schedule передає id клієнтів зі своїх утримань (holds_select уже лишає лише утримання слотів терапевта).
create or replace function public.schedule_client_names(p_client_ids uuid[])
returns table (id uuid, name text)
language sql
stable
security definer
as $$
  select c.id, c.name
  from public.clients as c
  where c.id = any (p_client_ids);
$$;

revoke execute on function public.schedule_client_names(uuid[]) from public, anon;
grant execute on function public.schedule_client_names(uuid[]) to authenticated;
