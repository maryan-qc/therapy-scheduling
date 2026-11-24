// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
// WS11: health показує середовище (appEnv) і ref проєкту бази (supabaseRef) — без секретів і без довільних рядків.
import { describe, expect, it } from "vitest";
import { appEnvName, classifyDbProbe, supabaseRefFromUrl } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
    expect(classifyDbProbe({ status: 500, error: { code: "PGRSTX00", message: "connection library error" } })).toEqual({
      db: "down",
      reason: "status-500-PGRSTX00",
    });
    expect(classifyDbProbe({ status: 500, error: { code: "PGRST300", message: "JWT secret is missing" } }).db).toBe("down");
  });

  it("не рахує базу живою, коли Postgres не обслуговує запити (53300, 57P03, 08006)", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "53300", message: "too many connections" } })).toEqual({
      db: "down",
      reason: "status-503-53300",
    });
    expect(classifyDbProbe({ status: 503, error: { code: "57P03", message: "the database system is starting up" } }).db).toBe(
      "down",
    );
    expect(classifyDbProbe({ status: 503, error: { code: "08006", message: "connection failure" } }).db).toBe("down");
  });
});

describe("supabaseRefFromUrl (/api/health → supabaseRef)", () => {
  it("бере ref — перший сегмент хоста https://<ref>.supabase.co", () => {
    expect(supabaseRefFromUrl("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(supabaseRefFromUrl("https://abcdefghijklmnopqrst.supabase.co/")).toBe("abcdefghijklmnopqrst");
  });

  it("повертає null без змінної, на не-https, чужому хості й неадресі", () => {
    expect(supabaseRefFromUrl(undefined)).toBeNull();
    expect(supabaseRefFromUrl("")).toBeNull();
    expect(supabaseRefFromUrl("http://abcdefghijklmnopqrst.supabase.co")).toBeNull();
    expect(supabaseRefFromUrl("http://127.0.0.1:54321")).toBeNull();
    expect(supabaseRefFromUrl("https://abc.supabase.co.evil.example")).toBeNull();
    expect(supabaseRefFromUrl("https://a.b.supabase.co")).toBeNull();
    expect(supabaseRefFromUrl("не адреса")).toBeNull();
  });
});

describe("appEnvName (/api/health → appEnv)", () => {
  it("повертає назву середовища з APP_ENV, обрізавши пробіли", () => {
    expect(appEnvName("staging")).toBe("staging");
    expect(appEnvName(" staging \n")).toBe("staging");
  });

  it("null без змінної (прод) і для порожнього значення", () => {
    expect(appEnvName(undefined)).toBeNull();
    expect(appEnvName("  ")).toBeNull();
  });

  it("не віддає в публічну відповідь довільний рядок: інше значення — «invalid»", () => {
    expect(appEnvName("staging; drop")).toBe("invalid");
    expect(appEnvName("x".repeat(33))).toBe("invalid");
  });
});
