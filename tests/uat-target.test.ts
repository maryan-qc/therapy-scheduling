// WS11, трек A: UAT на розгорнутій адресі не пише в базу, якщо ціль і .env.local ходять у різні проєкти Supabase.
import { describe, expect, it } from "vitest";
import { bypassHeaders, checkTargetRef } from "./e2e/support/target";

const STAGING = "https://stagingrefaaaaaaaaaa.supabase.co";

describe("checkTargetRef (UAT: та сама база в цілі й у .env.local)", () => {
  it("пропускає, коли supabaseRef цілі = ref локальної NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(checkTargetRef({ ok: true, supabaseRef: "stagingrefaaaaaaaaaa" }, STAGING)).toEqual({
      ok: true,
      ref: "stagingrefaaaaaaaaaa",
    });
  });

  it("зупиняє, коли ціль ходить в іншу базу (напр. прод), і називає обидва ref", () => {
    const check = checkTargetRef({ supabaseRef: "prodrefbbbbbbbbbbbbb" }, STAGING);
    expect(check.ok).toBe(false);
    expect(!check.ok && check.message).toMatch(/prodrefbbbbbbbbbbbbb.*stagingrefaaaaaaaaaa/);
  });

  it("зупиняє, коли ціль не показує supabaseRef (деплой до WS11)", () => {
    const check = checkTargetRef({ ok: true, sha: "abc" }, STAGING);
    expect(!check.ok && check.message).toMatch(/supabaseRef/);
    expect(checkTargetRef({ supabaseRef: null }, STAGING).ok).toBe(false);
  });

  it("зупиняє, коли health не прочитано (стіна входу Vercel, мережа)", () => {
    const check = checkTargetRef(null, STAGING);
    expect(!check.ok && check.message).toMatch(/VERCEL_AUTOMATION_BYPASS_SECRET/);
    expect(checkTargetRef("<html>", STAGING).ok).toBe(false);
  });

  it("зупиняє без локальної адреси бази чи з не-supabase адресою", () => {
    expect(checkTargetRef({ supabaseRef: "x" }, undefined).ok).toBe(false);
    expect(checkTargetRef({ supabaseRef: "x" }, "http://127.0.0.1:54321").ok).toBe(false);
  });
});

describe("bypassHeaders (захист Vercel)", () => {
  it("додає заголовок обходу лише коли секрет задано, без запиту cookie (переспрямування зламало б health)", () => {
    expect(bypassHeaders(undefined)).toBeUndefined();
    expect(bypassHeaders("")).toBeUndefined();
    expect(bypassHeaders("s3cr3t")).toEqual({ "x-vercel-protection-bypass": "s3cr3t" });
  });
});
