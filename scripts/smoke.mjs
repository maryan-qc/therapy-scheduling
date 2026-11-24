#!/usr/bin/env node
// Smoke розгорнутого застосунку (D0 → WS11 v2): лише GET, без входу й форм (Node 24, без залежностей).
// Використання: node scripts/smoke.mjs <base-url> [expected-sha]     (або npm run smoke -- <base-url> [sha])
//   1) "/api/health" → 200 {db:"ok"}; з expected-sha — sha збігається (до 6 спроб × 20 с: прод-домен перемикається
//                      на новий деплой не миттєво; адреса конкретного деплою показує свій коміт одразу);
//   2) "/"           → редірект на /login того самого origin або 200 (не 401/404/5xx і не стіна входу Vercel);
//   3) "/login"      → 200 і поле пароля (застосунок справді віддає сторінку).
// Код виходу: 0 — усе гаразд, 1 — є збій (рядки ::error:: видно в GitHub Actions), 2 — не вказано адресу.
//
// WS11 (v2, взято з materials/ops-kit/scripts/smoke.mjs курсу):
//   - VERCEL_AUTOMATION_BYPASS_SECRET задано → кожен запит несе заголовок x-vercel-protection-bypass: так smoke
//     відкриває preview і staging за захистом Vercel. Значення не друкуємо: у журналі лише "bypass": true/false.
//     x-vercel-set-bypass-cookie НЕ надсилаємо: він для браузера й відповідає редіректом із Set-Cookie, а smoke
//     з redirect:"manual" побачив би 3xx замість сторінки;
//   - SMOKE_TARGET=deploy (ставить job deploy у smoke.yml) змінює лише підказки в повідомленнях про збій.
// Наше (з D0, понад набір): межа 15 с на запит; "/" має вести саме на /login того самого origin; спершу чекаємо
// коміт у /api/health, потім сторінки (усі перевірки — на одному деплої); HTTP-статус health не перезаписується
// полем status з JSON; db=ok без 200 і відповідь без sha при очікуваному коміті — теж збій.
const [rawBase = process.env.PROD_URL ?? "", expectSha = ""] = process.argv.slice(2);
const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
const target = process.env.SMOKE_TARGET === "deploy" ? "deploy" : "prod";
// client_payload.url від Vercel може прийти хостом без схеми — додаємо https://.
const base = (/^https?:\/\//.test(rawBase) ? rawBase : rawBase ? `https://${rawBase}` : "").replace(/\/+$/, "");
const headers = { "user-agent": "smoke/2.0 (WS11)" };
// Наше: секрет обходу — лише по https. По http:// заголовок пішов би відкритим каналом (рев'ю CodeRabbit до #64);
// адреса без схеми (client_payload.url) уже стала https:// вище.
if (bypass && base.startsWith("http://")) {
  console.log("::error title=smoke::Адреса з http:// — секрет обходу Vercel відкритим каналом не надсилаємо. Вкажіть https://…");
  process.exit(1);
}
if (bypass) headers["x-vercel-protection-bypass"] = bypass;

const get = async (path) => {
  try {
    // Межа на кожен запит: сервер, що прийняв з'єднання й мовчить, не тримає прогін до timeout-minutes workflow.
    const r = await fetch(base + path, {
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return {
      status: r.status,
      location: r.headers.get("location") ?? "",
      vercelError: r.headers.get("x-vercel-error") ?? "",
      text: await r.text(),
    };
  } catch (e) {
    return { status: 0, location: "", vercelError: "", text: String(e.cause?.code ?? e) };
  }
};
// Шлях, куди веде редирект; некоректний Location — "" (це теж збій, а не виняток посеред перевірок).
// Редирект на інший origin (навіть на «…/login») — теж "".
const redirectPath = (location) => {
  try {
    const target = new URL(location || "/", `${base}/`);
    return target.origin === new URL(base).origin ? target.pathname : "";
  } catch {
    return "";
  }
};
// Підказка залежить від того, що перевіряємо і чи є секрет обходу.
function wallHint() {
  if (bypass) {
    return "Vercel не прийняв секрет обходу — його перегенерували чи видалили? Скопіюйте актуальний з Vercel (Settings → Deployment Protection → Protection Bypass for Automation) у GitHub Secrets VERCEL_AUTOMATION_BYPASS_SECRET і зробіть Redeploy";
  }
  if (target === "deploy") {
    return "деплой за захистом Vercel, а секрету обходу немає — увімкніть Protection Bypass for Automation (Vercel → Settings → Deployment Protection) і додайте значення в GitHub Secrets як VERCEL_AUTOMATION_BYPASS_SECRET";
  }
  return "прод за стіною входу Vercel — Settings → Deployment Protection: Standard Protection (захищає preview і staging, прод відкритий), не All Deployments";
}
const vercelWall = (r) =>
  /vercel\.com\/(sso|login)|_vercel_sso/.test(r.location) || ((r.status === 401 || r.status === 403) && /vercel/i.test(r.text));

async function main() {
  const fail = [];
  // Спершу чекаємо, поки прод-домен покаже очікуваний коміт, і лише потім перевіряємо сторінки: так "/" і "/login"
  // перевіряються на тому самому деплої, що й /api/health.
  let health = null;
  for (let attempt = 1; attempt <= (expectSha ? 6 : 1); attempt++) {
    const r = await get("/api/health");
    // HTTP-статус — після тіла: поле status у JSON не перезапише справжній.
    try {
      health = { ...JSON.parse(r.text), status: r.status };
    } catch {
      health = { status: r.status, location: r.location };
    }
    // Чекаємо й на 307/404 без sha: поки домен перемикається, відповідає ще попередній деплой.
    // sha=local — Vercel не віддає VERCEL_GIT_COMMIT_SHA: чекати марно.
    if (!expectSha || health.sha === expectSha || health.sha === "local") break;
    if (attempt < 6) await new Promise((res) => setTimeout(res, 20_000));
  }

  const root = await get("/");
  if (vercelWall(root)) fail.push(`"/": ${wallHint()}`);
  else if (root.status === 0) fail.push(`"/": недоступний (${root.text})`);
  else if (root.status >= 400) {
    const hint = root.vercelError === "MIDDLEWARE_INVOCATION_FAILED" ? " — у Vercel бракує NEXT_PUBLIC_SUPABASE_*?" : "";
    fail.push(`"/": HTTP ${root.status} ${root.vercelError}${hint}`.trim());
  } else if (root.status >= 300 && redirectPath(root.location) !== "/login") {
    fail.push(`"/": ${root.status} → ${root.location || "(без Location)"} — очікувався редирект на /login`);
  }

  const login = await get("/login");
  if (login.status !== 200 || !/type=["']?password/i.test(login.text)) {
    fail.push(`"/login": HTTP ${login.status} ${login.vercelError}${login.status === 200 ? " (немає поля пароля)" : ""}`.trim());
  }

  if (login.status !== 200) {
    // прод не відкрився — причина вже у fail
  } else if (health.status === 404) {
    fail.push(`"/api/health": 404 — додайте src/app/api/health/route.ts`);
  } else if (health.status >= 300 && health.status < 400) {
    fail.push(`"/api/health": ${health.status} → ${health.location} — додайте "/api/health" у PUBLIC_PATHS (src/lib/supabase/proxy.ts)`);
  } else if (health.reason === "paused") {
    fail.push(`"/api/health": Supabase призупинено — Dashboard → Resume project у проєкті цієї бази (безкоштовний проєкт засинає після 7 днів без достатньої активності бази)`);
  } else if (health.reason === "invalid-api-key") {
    fail.push(`"/api/health": ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY у Vercel не приймається — звірте змінні цього середовища і зробіть Redeploy`);
  } else if (health.db !== "ok") {
    fail.push(
      `"/api/health": HTTP ${health.status}, db=${health.db ?? "?"}${health.reason ? ` (${health.reason})` : ""} — Supabase недоступний чи NEXT_PUBLIC_SUPABASE_URL у Vercel не той?`,
    );
  } else if (health.status !== 200) {
    fail.push(`"/api/health": HTTP ${health.status} при db=ok — очікувався 200`);
  }
  if (expectSha && health?.sha === "local") {
    fail.push(`"/api/health": sha=local — у Vercel увімкніть Settings → Environment Variables → «Automatically expose System Environment Variables» і зробіть Redeploy`);
  } else if (expectSha && health && health.status < 300 && health.sha !== expectSha) {
    // Відповідь без sha теж не підтверджує деплой main.
    const shown = health.sha ? String(health.sha).slice(0, 7) : "відповідь без sha";
    const why =
      target === "deploy"
        ? "адреса деплою показує інший коміт — чи та адреса в client_payload.url?"
        : "деплой main не пройшов чи зроблено Instant Rollback?";
    fail.push(`${base} показує ${shown}, а очікувався ${expectSha.slice(0, 7)} — ${why}`);
  }

  // Лише статуси й відповідь /api/health (публічна, без секретів). Секрет обходу — тільки як true/false.
  console.log(JSON.stringify({ base, target, bypass: Boolean(bypass), root: root.status, login: login.status, health }));
  for (const f of fail) console.log(`::error title=smoke ${base}::${f}`);
  if (!fail.length) console.log("OK — застосунок живий, сторінка входу відкривається, база відповідає.");
  return fail.length ? 1 : 0;
}

// process.exitCode, а не process.exit(): на Windows exit() після fetch падає з assertion libuv.
if (!base) {
  console.error("Використання: node scripts/smoke.mjs <base-url> [expected-sha]  (або змінна PROD_URL)");
  process.exitCode = 2;
} else {
  process.exitCode = await main();
}
