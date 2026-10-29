// Proxy сесії (src/lib/supabase/proxy.ts): які шляхи відкриті без входу і для яких клієнт Supabase не створюється.
// Клієнт @supabase/ssr підмінено: тест перевіряє рішення proxy, а не мережу.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getClaims } = vi.hoisted(() => {
  const getClaims = vi.fn();
  return { getClaims, createServerClient: vi.fn(() => ({ auth: { getClaims } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const { isPublicPath, isSessionlessPath, updateSession } = await import("@/lib/supabase/proxy");

beforeEach(() => {
  createServerClient.mockClear();
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: null } });
});

describe("isPublicPath і isSessionlessPath", () => {
  it("пускає без входу лише самі публічні шляхи та їхні підшляхи, не шляхи з тим самим префіксом", () => {
    for (const path of ["/login", "/auth/confirm", "/api/health"]) expect(isPublicPath(path)).toBe(true);
    for (const path of ["/api/healthz", "/api/health-admin", "/loginx", "/clients", "/"]) expect(isPublicPath(path)).toBe(false);
  });

  it("без сесії — лише /api/health: сторінки входу й застосунку сесію оновлюють", () => {
    expect(isSessionlessPath("/api/health")).toBe(true);
    for (const path of ["/login", "/auth/confirm", "/api/healthz", "/clients"]) expect(isSessionlessPath(path)).toBe(false);
  });
});

describe("updateSession", () => {
  it("для /api/health не створює клієнт Supabase і не викликає getClaims()", async () => {
    const response = await updateSession(new NextRequest("http://localhost/api/health"));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("сторінку застосунку без входу перенаправляє на /login, перевіривши сесію", async () => {
    const response = await updateSession(new NextRequest("http://localhost/clients"));

    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  });
});
