-- Зріз 3: статус перевірки страхування в картці клієнта (openspec/specs/insurance-status; план —
-- openspec/changes/impl-insurance-consent/design.md, «Статус перевірки страхування»).
-- Застосовані міграції не змінюємо: нова колонка, функції й права. Політика clients_select не змінюється: статус бачать
-- ті, хто бачить картку — персонал усі, терапевт лише своїх клієнтів (AC-INS-04). Колонкового grant update і політики
-- update на clients немає, тож напряму статус не змінює ніхто, зокрема терапевт (AC-INS-05): лише функція нижче.

-- ── Колонка ─────────────────────────────────────────────────────────────────
-- Картки зрізів 1–2 отримують «Not set» з default, як і нові (припущення PM; AC-INS-01).
alter table public.clients
  add column insurance_status text not null default 'not_set',
  add constraint clients_insurance_status_check
    check (insurance_status in ('not_set', 'verified', 'not_accepted', 'private_pay'));

-- ── Позначення статусу ──────────────────────────────────────────────────────
create or replace function private.set_insurance_status(p_client_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Позначає лише планувальник або адміністратор (AC-INS-02, AC-INS-03); терапевт — ні (AC-INS-05).
  if not (select private.is_staff()) then
    return jsonb_build_object('code', 'INSURANCE_FORBIDDEN');
  end if;
  -- «Not set» — лише початковий: повернути його не можна (припущення PM).
  if p_status is null or p_status not in ('verified', 'not_accepted', 'private_pay') then
    return jsonb_build_object('code', 'INVALID_STATUS');
  end if;
  update public.clients set insurance_status = p_status where id = p_client_id;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.set_insurance_status(p_client_id uuid, p_status text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_insurance_status(p_client_id, p_status);
$$;

-- ── Права ───────────────────────────────────────────────────────────────────
-- Без входу — нічого (AC-INS-06).
revoke execute on function private.set_insurance_status(uuid, text) from public, anon;
revoke execute on function public.set_insurance_status(uuid, text) from public, anon;
grant execute on function private.set_insurance_status(uuid, text) to authenticated;
grant execute on function public.set_insurance_status(uuid, text) to authenticated;
