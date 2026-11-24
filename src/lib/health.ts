// D0: чи відповіла база на запит /api/health. Чиста функція — щоб перевірити всі гілки тестом без мережі.
// Запит — публічним ключем до таблиці без доступу для anon: «немає прав» (42501) теж означає, що Postgres живий.

/** Код SQLSTATE Postgres, напр. 42501 «permission denied»: запит дійшов до бази. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** PostgREST не обслуговує запити: не може під'єднатися до бази (PGRST000–003), не має JWT secret (PGRST300),
 *  внутрішня помилка бібліотеки з'єднання (PGRSTX00, HTTP 500). */
const PGRST_DB_DOWN = /^(PGRST00[0-3]|PGRST300|PGRSTX00)$/;
/** Класи SQLSTATE, коли Postgres не обслуговує запити: 08 — з'єднання, 53 — ресурси (53300 — забагато з'єднань),
 *  57 — втручання оператора (57P03 — база ще не приймає з'єднань). */
const SQLSTATE_DB_DOWN = /^(08|53|57)/;
/** Supabase відповідає 540, коли безкоштовний проєкт призупинено (Dashboard → Resume project). */
const SUPABASE_PAUSED = 540;

export type DbProbe = { status: number; error: { code?: string; message?: string } | null };
export type DbHealth = { db: "ok" | "down"; reason: string };

export function classifyDbProbe({ status, error }: DbProbe): DbHealth {
  if (status === SUPABASE_PAUSED) return { db: "down", reason: "paused" };
  const code = error?.code ?? "";
  const sqlstateUp = SQLSTATE.test(code) && !SQLSTATE_DB_DOWN.test(code);
  if (!error || sqlstateUp || (code.startsWith("PGRST") && !PGRST_DB_DOWN.test(code))) {
    return { db: "ok", reason: "" };
  }
  if (/api key/i.test(error.message ?? "")) return { db: "down", reason: "invalid-api-key" };
  // 0 — мережа (Supabase недоступний або хибний URL), 5xx, PGRST000–003, PGRST300, PGRSTX00, SQLSTATE класів 08, 53, 57.
  return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
}

// WS11, трек A: /api/health показує, яке це середовище і в яку базу Supabase воно ходить. Обидва значення — не
// секрети, але health публічний, тож пропускаємо лише очікувану форму, а не будь-який рядок із змінної.

/** Ref проєкту Supabase — перший сегмент хоста https://<ref>.supabase.co (те саме бачить браузер). */
const SUPABASE_HOST = /^([a-z0-9]+)\.supabase\.co$/;
/** Назва середовища з APP_ENV: коротке слово (staging, prod-like, …). Інше в публічну відповідь не потрапляє. */
const APP_ENV_NAME = /^[A-Za-z0-9._-]{1,32}$/;

/** Ref проєкту з NEXT_PUBLIC_SUPABASE_URL або null (змінної немає, не https чи хост не *.supabase.co). */
export function supabaseRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return SUPABASE_HOST.exec(parsed.hostname)?.[1] ?? null;
}

/** APP_ENV для health: null, коли змінної немає (прод); "invalid", коли значення не схоже на назву середовища. */
export function appEnvName(value: string | undefined): string | null {
  const name = value?.trim();
  if (!name) return null;
  return APP_ENV_NAME.test(name) ? name : "invalid";
}
