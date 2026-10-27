-- Уточнення зрізу 2 після відповідей PM 26.10 (openspec/changes/archive/2026-10-27-clarify-client-cards).
-- Застосовані міграції не змінюємо: новий індекс і нова версія функції.

-- ── Дублікат картки дитини (AC-CARD-13, Sofiia-pm/therapy-scheduling-spec#23) ─────────────────────────
-- Та сама дитина — те саме ім'я без урахування регістру (пробіли по краях уже прибирає clients_name_trimmed), та сама
-- дата народження й той самий email опікуна (уже малими літерами — clients_guardian_email_normalized). Близнюки з
-- одним опікуном і різними іменами — різні картки. Помилка — 23505 з назвою індексу, за нею застосунок показує
-- «A client with these details already exists.».
create unique index clients_child_card_key
  on public.clients (lower(name), date_of_birth, guardian_email)
  where client_type = 'child';

-- ── «Свій клієнт» для терапевта (AC-CARD-14, Sofiia-pm/therapy-scheduling-spec#25) ──────────────────────
-- Утримання «Held» робить клієнта своїм лише до початку слоту (з моменту початку включно — ні); сеанс «Confirmed» —
-- без обмеження в часі, зокрема минулий. Від цієї функції залежить політика clients_select.
-- Утримання в розкладі терапевта (holds_select) не змінюється: «Held» лишається видимим до прострочення (AC-HOLD-22).
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
      and (
        h.confirmed_at is not null
        or (h.released_at is null and now() < h.expires_at and now() < s.starts_at)
      )
  );
$$;
