// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { classifyDbProbe } from "@/lib/health";
import { isPublicPath, isSessionlessPath } from "@/lib/supabase/proxy";

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

describe("isPublicPath (proxy)", () => {
  it("пускає без входу лише самі публічні шляхи та їхні підшляхи, не шляхи з тим самим префіксом", () => {
    for (const path of ["/login", "/auth/confirm", "/api/health"]) expect(isPublicPath(path)).toBe(true);
    for (const path of ["/api/healthz", "/api/health-admin", "/loginx", "/clients", "/"]) expect(isPublicPath(path)).toBe(false);
  });

  it("без сесії — лише /api/health: сторінки входу й застосунку сесію оновлюють", () => {
    expect(isSessionlessPath("/api/health")).toBe(true);
    for (const path of ["/login", "/auth/confirm", "/api/healthz", "/clients"]) expect(isSessionlessPath(path)).toBe(false);
  });
});
