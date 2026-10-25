import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runScript } from "./run-script";

// npm run users:demo запускає скрипт з `node --env-file=.env.local`, а той читає «#» без лапок як коментар:
// «abcd1234!@#» стає «abcd1234!@». Скрипт має зупинитися до будь-якого запиту до Supabase.
const GUARD = "містить «#» без лапок";
const temps: string[] = [];

function project(envLine: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "demo-users-"));
  temps.push(dir);
  writeFileSync(path.join(dir, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9\n${envLine}\n`);
  return dir;
}

// Значення, яке node --env-file уже передав скрипту (обрізане чи ні), — у process.env.
const env = (password: string) => ({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  DEMO_USER_PASSWORD: password,
});

afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("scripts/create-demo-users.mjs — пароль з «#» у .env.local", () => {
  it("значення без лапок із «#» — зупинка з поясненням, нічого не створено", () => {
    const { code, out } = runScript("create-demo-users.mjs", project("DEMO_USER_PASSWORD=abcd1234!@#"), env("abcd1234!@"));

    expect(code).toBe(1);
    expect(out).toContain(GUARD);
    expect(out).not.toContain("✔");
  });

  it("значення в лапках — перевірка пропускає далі", () => {
    const { out } = runScript("create-demo-users.mjs", project('DEMO_USER_PASSWORD="abcd1234!@#"'), env("abcd1234!@#"));

    expect(out).not.toContain(GUARD);
    expect(out).toContain("demo-users.json"); // дійшов до наступного кроку — читання списку користувачів
  });

  it("діє останній запис: другий DEMO_USER_PASSWORD без лапок із «#» — теж зупинка", () => {
    const dir = project('DEMO_USER_PASSWORD="abcd1234!@#"\nDEMO_USER_PASSWORD=abcd1234!@#');
    const { code, out } = runScript("create-demo-users.mjs", dir, env("abcd1234!@"));

    expect(code).toBe(1);
    expect(out).toContain(GUARD);
  });
});
