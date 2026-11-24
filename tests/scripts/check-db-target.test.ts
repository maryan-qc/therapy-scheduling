// scripts/check-db-target.mjs — запобіжник «не та база» перед supabase db push у CI (WS11, трек A).
// Рядки підключення тут вигадані: ref із 20 однакових літер, пароль «pw-test».
// Назви тестів без AC ID: технічна перевірка CI, а не критерій приймання.
import { describe, expect, it } from "vitest";
import { checkDbTarget, parseDbTarget } from "../../scripts/check-db-target.mjs";
import { repoRoot, runScript } from "./run-script";

const STAGING = "aaaaaaaaaaaaaaaaaaaa";
const PROD = "bbbbbbbbbbbbbbbbbbbb";
const pooler = (ref: string, tail = "") =>
  `postgresql://postgres.${ref}:pw-test@aws-0-eu-west-3.pooler.supabase.com:5432/postgres${tail}`;

describe("parseDbTarget", () => {
  it("рядок Session pooler → ref і хост; sslmode дозволено, postgres:// теж", () => {
    expect(parseDbTarget(pooler(STAGING))).toEqual({ ref: STAGING, host: "aws-0-eu-west-3.pooler.supabase.com" });
    expect(parseDbTarget(pooler(STAGING, "?sslmode=require"))).toEqual({ ref: STAGING, host: "aws-0-eu-west-3.pooler.supabase.com" });
    expect(parseDbTarget(pooler(STAGING).replace("postgresql://", "postgres://"))).toMatchObject({ ref: STAGING });
  });

  it("параметри, що перевизначають ціль (?user=, ?host=, ?options=reference…), відхилено", () => {
    for (const tail of [
      `?user=postgres.${PROD}`,
      "?host=db.example.test",
      "?dbname=other",
      `?options=reference%3D${PROD}`,
      `?sslmode=require&user=postgres.${PROD}`,
      "#frag",
    ]) {
      expect(parseDbTarget(pooler(STAGING, tail))).toHaveProperty("error");
    }
  });

  it("не Session pooler: пряме підключення, чужий хост, інша база, не postgres-схема, не адреса", () => {
    expect(parseDbTarget(`postgresql://postgres:pw@db.${STAGING}.supabase.co:5432/postgres`)).toHaveProperty("error");
    expect(parseDbTarget(`postgresql://postgres.${STAGING}:pw@evil.example.test:5432/postgres`)).toHaveProperty("error");
    expect(parseDbTarget(pooler(STAGING).replace("/postgres", "/other"))).toHaveProperty("error");
    expect(parseDbTarget(pooler(STAGING).replace("postgresql://", "https://"))).toHaveProperty("error");
    expect(parseDbTarget("не адреса")).toHaveProperty("error");
  });

  it("текст помилки не містить рядка, пароля чи ref", () => {
    const { error } = parseDbTarget(pooler(STAGING, `?user=postgres.${PROD}`)) as { error: string };
    for (const part of ["pw-test", STAGING, PROD, "pooler"]) expect(error).not.toContain(part);
  });
});

describe("checkDbTarget", () => {
  const ok = { url: pooler(STAGING), expectedRef: STAGING, otherRef: PROD, label: "staging" };

  it("збіг ref — рядок з ref і хостом (без пароля)", () => {
    const result = checkDbTarget(ok);
    expect(result).toEqual({ ok: true, line: `Ціль міграцій: проєкт ${STAGING} (staging), хост aws-0-eu-west-3.pooler.supabase.com` });
  });

  it("рядок проду в environment staging — зупинка з поясненням", () => {
    const result = checkDbTarget({ ...ok, url: pooler(PROD) });
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toContain("у другий проєкт");
  });

  it("немає секрету, немає змінних репо чи вони однакові — зупинка", () => {
    expect(checkDbTarget({ ...ok, url: undefined }).ok).toBe(false);
    expect(checkDbTarget({ ...ok, expectedRef: "" }).ok).toBe(false);
    expect(checkDbTarget({ ...ok, otherRef: STAGING }).ok).toBe(false);
  });
});

describe("scripts/check-db-target.mjs у CI", () => {
  const env = (url: string) => ({ SUPABASE_DB_URL: url, EXPECTED_REF: STAGING, OTHER_REF: PROD, LABEL: "staging" });

  it("код 0 і рядок цілі; пароля у виводі немає", () => {
    const { code, out } = runScript("check-db-target.mjs", repoRoot, env(pooler(STAGING)));
    expect(code).toBe(0);
    expect(out).toContain(`проєкт ${STAGING} (staging)`);
    expect(out).not.toContain("pw-test");
  });

  it("код 1 і ::error на ?user= з іншим проєктом; пароля у виводі немає", () => {
    const { code, out } = runScript("check-db-target.mjs", repoRoot, env(pooler(STAGING, `?user=postgres.${PROD}`)));
    expect(code).toBe(1);
    expect(out).toContain("::error title=db-deploy (staging)::");
    expect(out).not.toContain("pw-test");
  });
});
