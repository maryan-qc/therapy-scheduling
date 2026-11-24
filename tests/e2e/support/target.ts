// WS11, трек A: UAT на розгорнутій адресі пише в базу з ЛОКАЛЬНИХ ключів (.env.local: синтетичні uat-* користувачі
// секретним ключем, прямі запити Data API). Тепер .env.local = staging, тож прогін проти іншої цілі (прод, старий
// preview) змішав би бази: браузер ходив би в одну, а записи йшли б в іншу. Перед першим записом звіряємо ref
// проєкту Supabase з /api/health цілі (supabaseRef) з ref локальної NEXT_PUBLIC_SUPABASE_URL і зупиняємось при розбіжності.
// Ref — не секрет (є в публічній адресі бази), тож у повідомленні його можна показати; ключів і паролів — ніколи.
import { supabaseRefFromUrl } from "../../../src/lib/health";

/**
 * Заголовок обходу захисту Vercel — лише коли секрет задано (значення ніде не друкуємо). Без
 * x-vercel-set-bypass-cookie: з ним Vercel відповідає переспрямуванням, що ставить cookie, і перевірка health з
 * redirect: "manual" не отримала б JSON. Playwright і так додає заголовок до кожного запиту (extraHTTPHeaders).
 */
export function bypassHeaders(secret: string | undefined): Record<string, string> | undefined {
  return secret ? { "x-vercel-protection-bypass": secret } : undefined;
}

export type TargetCheck = { ok: true; ref: string } | { ok: false; message: string };

/**
 * health — розібране JSON з <ціль>/api/health або null (не JSON: стіна входу Vercel, мережа).
 * localSupabaseUrl — NEXT_PUBLIC_SUPABASE_URL із середовища прогону (.env.local).
 */
export function checkTargetRef(health: unknown, localSupabaseUrl: string | undefined): TargetCheck {
  const local = supabaseRefFromUrl(localSupabaseUrl);
  if (!local) {
    return { ok: false, message: "NEXT_PUBLIC_SUPABASE_URL не задано чи це не https://<ref>.supabase.co — з якою базою звіряти?" };
  }
  if (!health || typeof health !== "object") {
    return {
      ok: false,
      message:
        "не вдалося прочитати JSON з <ціль>/api/health: деплой закритий входом Vercel (задайте VERCEL_AUTOMATION_BYPASS_SECRET) чи адреса хибна.",
    };
  }
  const target = (health as { supabaseRef?: unknown }).supabaseRef;
  if (typeof target !== "string" || !target) {
    return {
      ok: false,
      message: "ціль не показує supabaseRef у /api/health (деплой зібрано до WS11?) — не знаю, у яку базу вона ходить.",
    };
  }
  if (target !== local) {
    return {
      ok: false,
      message: `ціль ходить у проєкт Supabase ${target}, а локальні ключі (.env.local) — у ${local}. UAT зупинено до першого запису.`,
    };
  }
  return { ok: true, ref: local };
}
