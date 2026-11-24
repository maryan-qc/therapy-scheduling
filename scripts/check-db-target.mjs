#!/usr/bin/env node
// WS11, трек A: запобіжник «не та база» перед `supabase db push` у CI (jobs db-deploy-staging і db-deploy).
// Рядок підключення (секрет SUPABASE_DB_URL environment-а) має бути рядком Session pooler з Connect:
//   postgresql://postgres.<ref>:<пароль>@<регіон>.pooler.supabase.com:5432/postgres[?sslmode=…]
// і його <ref> має дорівнювати очікуваному (змінна репо SUPABASE_STAGING_REF чи SUPABASE_PROD_REF).
// Будь-який параметр, крім sslmode, відхиляємо: ?user=, ?host=, ?dbname=, ?options=reference=… CLI застосує ПІСЛЯ
// нашої перевірки, і рядок «postgres.<staging>…?user=postgres.<prod>» мігрував би прод (рев'ю CodeRabbit до PR #65).
// Друкує лише ref і хост пулера — не секрети (ref є в публічній адресі бази, хост — спільний пулер регіону, з нього
// видно регіон). Сам рядок і пароль не друкує ніколи; значення секрету GitHub ще й маскує в журналі.
// Використання (у CI): SUPABASE_DB_URL=… EXPECTED_REF=… OTHER_REF=… LABEL=staging node scripts/check-db-target.mjs
// Код виходу: 0 — ціль та, що треба; 1 — ні (рядок ::error для GitHub Actions).
import { pathToFileURL } from "node:url";

const REF = /^postgres\.([a-z0-9]+)$/;
const POOLER_HOST = /^[a-z0-9-]+\.pooler\.supabase\.com$/;
const ALLOWED_PARAMS = new Set(["sslmode"]);

/** Розбирає рядок підключення: { ref, host } або { error } — без значень із рядка в тексті помилки. */
export function parseDbTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "не схожий на адресу postgresql://…" };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return { error: "схема не postgresql://" };
  if ([...url.searchParams.keys()].some((key) => !ALLOWED_PARAMS.has(key)) || url.hash) {
    return { error: "дозволено лише параметр sslmode (інші можуть перевизначити ціль підключення)" };
  }
  let user;
  try {
    user = decodeURIComponent(url.username);
  } catch {
    return { error: "користувач у рядку закодований некоректно" };
  }
  const ref = REF.exec(user)?.[1];
  if (!ref) return { error: "користувач не postgres.<ref> (це не рядок Session pooler)" };
  if (!POOLER_HOST.test(url.hostname)) return { error: "хост не *.pooler.supabase.com (це не рядок Session pooler)" };
  if (url.pathname !== "/postgres") return { error: "база в рядку не /postgres" };
  return { ref, host: url.hostname };
}

/** Повна перевірка для CI: { ok: true, line } або { ok: false, message }. */
export function checkDbTarget({ url, expectedRef, otherRef, label }) {
  if (!url) return { ok: false, message: `Секрет SUPABASE_DB_URL в environment ${label} не задано.` };
  if (!expectedRef || !otherRef || expectedRef === otherRef) {
    return { ok: false, message: "Задайте змінні репо SUPABASE_STAGING_REF і SUPABASE_PROD_REF (різні)." };
  }
  const target = parseDbTarget(url);
  if (target.error) {
    return { ok: false, message: `SUPABASE_DB_URL (${label}): ${target.error}. Скопіюйте рядок Session pooler з Connect у проєкті ${label}.` };
  }
  if (target.ref !== expectedRef) {
    const where = target.ref === otherRef ? "у другий проєкт (staging ↔ прод)" : `у проєкт ${target.ref}`;
    return { ok: false, message: `Рядок підключення ${label} веде ${where}, а очікували ${expectedRef}. Міграцію зупинено.` };
  }
  return { ok: true, line: `Ціль міграцій: проєкт ${target.ref} (${label}), хост ${target.host}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const label = /^[a-z]{1,20}$/.test(process.env.LABEL ?? "") ? process.env.LABEL : "target";
  const result = checkDbTarget({
    url: process.env.SUPABASE_DB_URL,
    expectedRef: process.env.EXPECTED_REF,
    otherRef: process.env.OTHER_REF,
    label,
  });
  if (!result.ok) {
    console.log(`::error title=db-deploy (${label})::${result.message}`);
    process.exit(1);
  }
  console.log(result.line);
}
