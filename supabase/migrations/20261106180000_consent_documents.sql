-- Зріз 3: документи згоди клієнта (openspec/specs/consent-documents; план —
-- openspec/changes/impl-insurance-consent/design.md, «Документи згоди»).
-- Застосовані міграції не змінюємо: нова таблиця, функції, права й нова версія private.confirm_hold_at (create or
-- replace) — з тими самими перевірками зрізу 1 у тому самому порядку і новою перевіркою документів після них.

-- ── Таблиця ─────────────────────────────────────────────────────────────────
-- Документи належать картці клієнта, а не утриманню (припущення PM): один набір на картку, unique (client_id, kind).
create table public.consent_documents (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null
    check (kind in ('consent_to_treatment', 'cancellation_policy', 'release_of_information')),
  position    smallint not null,
  prepared_at timestamptz not null,
  signed_at   timestamptz,
  signed_by   uuid references auth.users (id),
  unique (client_id, kind)
);

alter table public.consent_documents enable row level security;

-- Читання — як картки: персонал усі, терапевт лише своїх клієнтів (AC-DOC-09, AC-DOC-10); anon нічого (AC-DOC-11).
-- insert / update / delete — без GRANT і без політик: пишуть лише функції нижче (AC-DOC-09).
revoke all on table public.consent_documents from anon, authenticated;
grant select on table public.consent_documents to authenticated;
grant select, insert, update, delete on table public.consent_documents to service_role;

create policy consent_documents_select
  on public.consent_documents
  for select
  to authenticated
  using ((select private.is_staff()) or private.is_client_of_current_therapist(client_id));

-- ── Формування документів ───────────────────────────────────────────────────
create or replace function private.prepare_consent_documents_at(p_client_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  -- Формує лише планувальник або адміністратор (матриця прав).
  if not (select private.is_staff()) then
    return jsonb_build_object('code', 'PREPARE_FORBIDDEN');
  end if;
  -- Рядок клієнта блокуємо: два одночасні формування чекають одне одного, і друге бачить уже створений набір.
  select client_type into v_type from public.clients where id = p_client_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  if exists (select 1 from public.consent_documents where client_id = p_client_id) then
    return jsonb_build_object('code', 'ALREADY_PREPARED');
  end if;
  -- «Adult» — два документи, «Child» — три, у порядку набору (AC-DOC-02, AC-DOC-03).
  insert into public.consent_documents (client_id, kind, position, prepared_at)
  select p_client_id, d.kind, d.position, p_now
  from (values ('consent_to_treatment', 1), ('cancellation_policy', 2), ('release_of_information', 3))
    as d (kind, position)
  where d.position <= case when v_type = 'child' then 3 else 2 end;
  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.prepare_consent_documents(p_client_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.prepare_consent_documents_at(p_client_id, now());
$$;

-- ── Позначення підпису ──────────────────────────────────────────────────────
create or replace function private.sign_consent_document_at(p_document_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Позначає лише планувальник або адміністратор; терапевт — ні (AC-DOC-09).
  if not (select private.is_staff()) then
    return jsonb_build_object('code', 'SIGN_FORBIDDEN');
  end if;
  perform 1 from public.consent_documents where id = p_document_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  -- Скасувати чи повторити позначку не можна (поза зрізом): уже підписаний лишається як є.
  update public.consent_documents
  set signed_at = p_now, signed_by = (select auth.uid())
  where id = p_document_id and signed_at is null;
  if not found then
    return jsonb_build_object('code', 'ALREADY_SIGNED');
  end if;
  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.sign_consent_document(p_document_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.sign_consent_document_at(p_document_id, now());
$$;

-- ── Підтвердження утримання з документами ───────────────────────────────────
-- Перевірки зрізу 1 — як у 20261021160000_hold_and_confirm.sql і в тому самому порядку (припущення PM: вони
-- перевіряються раніше за документи); нова — остання.
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
  -- AC-DOC-07: документи клієнта сформовано, але не всі підписані — утримання лишається «Held». Документів не
  -- формували — як у зрізі 1 (AC-HOLD-12); усі підписані — підтверджуємо (AC-DOC-08).
  if exists (
    select 1 from public.consent_documents where client_id = v_hold.client_id and signed_at is null
  ) then
    return jsonb_build_object('code', 'UNSIGNED_DOCUMENTS');
  end if;

  -- AC-HOLD-12: утримання стає сеансом.
  update public.holds
  set confirmed_at = p_now, confirmed_by = (select auth.uid())
  where id = p_hold_id;

  return jsonb_build_object('code', 'OK');
end;
$$;

-- ── Права ───────────────────────────────────────────────────────────────────
revoke execute on function private.prepare_consent_documents_at(uuid, timestamptz) from public, anon;
revoke execute on function public.prepare_consent_documents(uuid) from public, anon;
revoke execute on function private.sign_consent_document_at(uuid, timestamptz) from public, anon;
revoke execute on function public.sign_consent_document(uuid) from public, anon;
grant execute on function private.prepare_consent_documents_at(uuid, timestamptz) to authenticated;
grant execute on function public.prepare_consent_documents(uuid) to authenticated;
grant execute on function private.sign_consent_document_at(uuid, timestamptz) to authenticated;
grant execute on function public.sign_consent_document(uuid) to authenticated;
