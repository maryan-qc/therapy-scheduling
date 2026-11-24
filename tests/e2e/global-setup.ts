// Playwright globalSetup: один раз перед усіма тестами (і перед входом ролей). Лише для розгорнутої цілі
// (UAT_BASE_URL): локальна збірка (npm run build && npm run start) читає той самий .env.local, тож база та сама.
// Чому і як — tests/e2e/support/target.ts.
import { bypassHeaders, checkTargetRef } from "./support/target";

export default async function globalSetup(): Promise<void> {
  const base = process.env.UAT_BASE_URL?.replace(/\/+$/, "");
  if (!base) return;
  let health: unknown = null;
  try {
    const res = await fetch(`${base}/api/health`, {
      headers: bypassHeaders(process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
      redirect: "manual",
    });
    if (res.headers.get("content-type")?.includes("json")) health = await res.json();
  } catch {
    health = null;
  }
  const check = checkTargetRef(health, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!check.ok) throw new Error(`UAT: ${check.message}`);
  console.log(`UAT: ціль і локальні ключі — той самий проєкт Supabase ${check.ref}`);
}
