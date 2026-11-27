-- Права ролей anon і authenticated на об'єкти схем public і private: схеми, таблиці й представлення, стовпці (понад
-- права на всю таблицю), послідовності, функції. Лише назви об'єктів і прав — жодних даних з таблиць.
-- Еталон — база, зібрана з міграцій репо: job restore-drill у .github/workflows/backup.yml кладе результат у Summary
-- прогону. Після справжнього відновлення в новий проєкт (docs/runbook.md, розділ 9, крок 5) той самий запит має дати
-- той самий список рядок у рядок:
--   psql -At -F '|' -v ON_ERROR_STOP=1 -f scripts/privileges.sql --dbname "$NEW_DB_URL"
with roles(role) as (
  values ('anon'::name), ('authenticated'::name)
),
rels as (
  select c.oid, n.nspname::text || '.' || c.relname::text as object, c.relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
)
select 'schema' as kind, n.nspname::text as object, r.role::text as role, p.priv
from pg_namespace n
cross join roles r
cross join (values ('USAGE'), ('CREATE')) as p(priv)
where n.nspname in ('public', 'private') and has_schema_privilege(r.role, n.oid, p.priv)
union all
select 'table', t.object, r.role::text, p.priv
from rels t
cross join roles r
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
where t.relkind <> 'S' and has_table_privilege(r.role, t.oid, p.priv)
union all
select 'column', t.object || '.' || a.attname::text, r.role::text, p.priv
from rels t
join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
cross join roles r
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p(priv)
where t.relkind <> 'S'
  and has_column_privilege(r.role, t.oid, a.attnum, p.priv)
  and not has_table_privilege(r.role, t.oid, p.priv)
union all
select 'sequence', t.object, r.role::text, p.priv
from rels t
cross join roles r
cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(priv)
where t.relkind = 'S' and has_sequence_privilege(r.role, t.oid, p.priv)
union all
select 'function', n.nspname::text || '.' || f.proname::text || '(' || pg_get_function_identity_arguments(f.oid) || ')',
  r.role::text, 'EXECUTE'
from pg_proc f
join pg_namespace n on n.oid = f.pronamespace
cross join roles r
where n.nspname in ('public', 'private') and has_function_privilege(r.role, f.oid, 'EXECUTE')
order by 1, 2, 3, 4;
