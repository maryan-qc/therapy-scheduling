-- Утримання й підтвердження — кожне однією транзакцією з перевірками (openspec/specs/slot-holds;
-- openspec/changes/impl-slot-hold/design.md, п. 3). supabase-js транзакцій не має, тому все робить функція бази.
--
-- Публічні функції (Data API) лише передають now(); внутрішні в private приймають p_now, і схема private не відкрита
-- в Data API, тож клієнт не підставить власний час. Відповідь — код, який сторінка перетворює на повідомлення PM.

-- ── Утримання ───────────────────────────────────────────────────────────────
create or replace function private.hold_slot_at(p_slot_id uuid, p_client_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.slots%rowtype;
  v_open public.holds%rowtype;
  v_hold_id uuid;
begin
  -- AC-HOLD-08: утримують лише планувальник і адміністратор.
  if not (select private.is_staff()) then
    return jsonb_build_object('code', 'HOLD_FORBIDDEN');
  end if;

  -- Рядок слота блокуємо: два одночасні утримання стають у чергу (AC-HOLD-04).
  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found or not exists (select 1 from public.clients where id = p_client_id) then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  -- Перевірку перетину клієнта теж серіалізуємо: інакше два утримання одного клієнта в різних терапевтів пройдуть разом.
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  -- AC-HOLD-07: слот, що вже почався (з моменту початку включно), не утримують.
  if p_now >= v_slot.starts_at then
    return jsonb_build_object('code', 'SLOT_STARTED');
  end if;

  -- AC-HOLD-03, AC-HOLD-17: відкрите утримання, ще не прострочене або підтверджене, займає слот.
  select * into v_open from public.holds where slot_id = p_slot_id and released_at is null;
  if found then
    if v_open.confirmed_at is not null or p_now < v_open.expires_at then
      return jsonb_build_object('code', 'SLOT_UNAVAILABLE');
    end if;
    -- AC-HOLD-06: прострочене звільняє та сама функція (unique index не знає про 24 години).
    update public.holds set released_at = p_now where id = v_open.id;
  end if;

  -- AC-HOLD-25, AC-HOLD-26: утримання й сеанси клієнта не перетинаються; прострочені не враховуються.
  if exists (
    select 1
    from public.holds as h
    join public.slots as s on s.id = h.slot_id
    where h.client_id = p_client_id
      and h.released_at is null
      and (h.confirmed_at is not null or p_now < h.expires_at)
      and s.starts_at < v_slot.ends_at
      and s.ends_at > v_slot.starts_at
  ) then
    return jsonb_build_object('code', 'CLIENT_BUSY');
  end if;

  -- AC-HOLD-02: утримання діє рівно 1440 хвилин від створення.
  insert into public.holds (slot_id, client_id, created_by, created_at, expires_at)
  values (p_slot_id, p_client_id, (select auth.uid()), p_now, p_now + interval '1440 minutes')
  returning id into v_hold_id;

  return jsonb_build_object('code', 'OK', 'hold_id', v_hold_id);
exception
  -- Друга лінія захисту AC-HOLD-04: частковий unique index не пропускає друге відкрите утримання слоту.
  when unique_violation then
    return jsonb_build_object('code', 'SLOT_UNAVAILABLE');
end;
$$;

create or replace function public.hold_slot(p_slot_id uuid, p_client_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.hold_slot_at(p_slot_id, p_client_id, now());
$$;

-- ── Підтвердження ───────────────────────────────────────────────────────────
create or replace function private.confirm_hold_at(p_hold_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.holds%rowtype;
  v_starts_at timestamptz;
begin
  -- AC-HOLD-14: підтверджують лише планувальник і адміністратор — будь-хто з них (AC-HOLD-27).
  if not (select private.is_staff()) then
    return jsonb_build_object('code', 'CONFIRM_FORBIDDEN');
  end if;

  -- Рядок утримання блокуємо: друге одночасне підтвердження побачить перше (AC-HOLD-36).
  select * into v_hold from public.holds where id = p_hold_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  if v_hold.confirmed_at is not null then
    return jsonb_build_object('code', 'ALREADY_CONFIRMED');
  end if;
  -- AC-HOLD-13: прострочене не підтверджують.
  if v_hold.released_at is not null or p_now >= v_hold.expires_at then
    return jsonb_build_object('code', 'HOLD_EXPIRED');
  end if;
  -- AC-HOLD-22: з моменту початку слоту (включно) не підтверджують; утримання лишається «Held».
  select starts_at into v_starts_at from public.slots where id = v_hold.slot_id;
  if p_now >= v_starts_at then
    return jsonb_build_object('code', 'SLOT_STARTED');
  end if;

  -- AC-HOLD-12: утримання стає сеансом.
  update public.holds
  set confirmed_at = p_now, confirmed_by = (select auth.uid())
  where id = p_hold_id;

  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.confirm_hold(p_hold_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_hold_at(p_hold_id, now());
$$;

-- ── Права ───────────────────────────────────────────────────────────────────
revoke execute on function private.hold_slot_at(uuid, uuid, timestamptz) from public, anon;
revoke execute on function private.confirm_hold_at(uuid, timestamptz) from public, anon;
revoke execute on function public.hold_slot(uuid, uuid) from public, anon;
revoke execute on function public.confirm_hold(uuid) from public, anon;
grant execute on function private.hold_slot_at(uuid, uuid, timestamptz) to authenticated;
grant execute on function private.confirm_hold_at(uuid, timestamptz) to authenticated;
grant execute on function public.hold_slot(uuid, uuid) to authenticated;
grant execute on function public.confirm_hold(uuid) to authenticated;
