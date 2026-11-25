// Трекер помилок без Sentry (WS11 B): повідомлення в Telegram з маршрутом і стеком, але без тексту помилки,
// заголовків, cookie, ?query і локальних шляхів; тестовий маршрут /api/ops/error-check закрито продом і роллю.
// Назви тестів без AC ID: технічна перевірка, а не критерій приймання.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  envLabel,
  errorDigest,
  errorName,
  formatErrorAlert,
  SAME_ERROR_PAUSE_MS,
  shouldSend,
  stackFrames,
  type AlertInput,
} from "@/lib/error-alert";

// Тестовий маршрут бере роль через requireViewer — підміняємо лише її (без бази й cookie).
const viewer = vi.hoisted(() => ({ role: "admin" as string | null, calls: 0 }));
vi.mock("@/lib/supabase/viewer", () => ({
  requireViewer: async () => {
    viewer.calls += 1;
    return { role: viewer.role };
  },
}));

// Текст помилки з даними користувача (так буває: помилка бази чи валідації цитує введене).
const SECRET = "Marker Clientname marker.client@example.test 1990-05-14";

function errorWithStack(message: string, frames: string[]): Error {
  const error = new Error(message);
  error.stack = [`Error: ${message}`, ...frames].join("\n");
  return error;
}

const FRAMES = [
  "    at insertClient (/Users/someone/projects/therapy-scheduling/src/app/clients/actions.ts:40:11)",
  "    at async /var/task/.next/server/app/clients/new/page.js:1:2048",
  "    at Object.handler (C:\\Users\\someone\\repo\\node_modules\\next\\dist\\server\\app.js:12:34)",
  "    at f4 (/var/task/.next/server/chunks/1.js:2:3)",
  "    at f5 (/var/task/.next/server/chunks/1.js:2:4)",
  "    at f6 (/var/task/.next/server/chunks/1.js:2:5)",
];

const base: AlertInput = {
  error: errorWithStack(`insert failed for ${SECRET}\nsecond line ${SECRET}`, FRAMES),
  method: "POST",
  routePath: "/clients/new",
  routeType: "action",
  routerKind: "App Router",
  env: "staging",
  branch: "staging",
  deploymentId: "dpl_test123",
  sha: "00fb4ff0123456789abcdef0123456789abcdef0",
};

describe("formatErrorAlert", () => {
  it("містить маршрут, метод, тип, середовище, гілку, деплой, коміт і рядки стеку", () => {
    const text = formatErrorAlert(base);
    expect(text).toContain("ПОМИЛКА СЕРВЕРА");
    expect(text).toContain("Маршрут: POST /clients/new (action, App Router)");
    expect(text).toContain("Середовище: staging (гілка staging)");
    expect(text).toContain("Деплой: dpl_test123, коміт 00fb4ff");
    expect(text).toContain("Помилка: Error");
    expect(text).toContain("at insertClient (src/app/clients/actions.ts:40:11)");
  });

  it("не містить тексту помилки (навіть багаторядкового), локальних шляхів і імені користувача ОС", () => {
    const text = formatErrorAlert(base);
    for (const part of ["Marker", "marker.client", "example.test", "1990-05-14", "second line", "insert failed", "someone", "/Users/", "C:\\"]) {
      expect(text).not.toContain(part);
    }
  });

  it("невідомий абсолютний шлях (зокрема file://) — лише ім'я файлу з рядком і колонкою", () => {
    const error = errorWithStack("boom", [
      "    at handler (/home/operator/app/handler.js:1:2)",
      "    at file:///Users/someone/tools/run.mjs:3:4",
      "    at async /var/task/.next/server/app/page.js:5:6",
    ]);
    const frames = stackFrames(error);
    expect(frames).toEqual(["at handler (handler.js:1:2)", "at run.mjs:3:4", "at async .next/server/app/page.js:5:6"]);
    expect(frames.join("\n")).not.toMatch(/operator|someone/);
  });

  it("заголовок стеку не збігся (текст змінили після запису стеку) — кадрів не надсилаємо", () => {
    const error = new Error("original");
    error.stack = ["Error: original", "    at marker.client@example.test:1:2", "    at f (/var/task/.next/a.js:1:1)"].join("\n");
    error.message = "changed";
    expect(stackFrames(error)).toEqual([]);
    expect(formatErrorAlert({ ...base, error })).not.toContain("marker");
  });

  it("клас помилки з this.name після super() — стек «Error: …» розпізнано, кадри є", () => {
    class SlotError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "SlotError";
      }
    }
    const error = new SlotError("boom");
    error.stack = ["Error: boom", ...FRAMES].join("\n");
    expect(stackFrames(error)[0]).toBe("at insertClient (src/app/clients/actions.ts:40:11)");
    expect(errorName(error)).toBe("SlotError");
  });

  it("не більше 5 рядків стеку, кожен до 160 символів", () => {
    const long = errorWithStack("x", [`    at ${"f".repeat(300)} (/var/task/.next/server/a.js:1:1)`, ...FRAMES]);
    const frames = stackFrames(long);
    expect(frames).toHaveLength(5);
    for (const frame of frames) expect(frame.length).toBeLessThanOrEqual(160);
  });

  it("відкидає ?query і #фрагмент, якщо вони потрапили в маршрут", () => {
    const text = formatErrorAlert({ ...base, routePath: `/clients/[id]?note=${SECRET}#x` });
    expect(text).toContain("Маршрут: POST /clients/[id] (action, App Router)");
    expect(text).not.toContain("Marker");
  });

  it("не-Error і помилка без стеку — лише тип, без стеку й без значення", () => {
    const text = formatErrorAlert({ ...base, error: SECRET });
    expect(text).toContain("Помилка: string");
    expect(text).not.toContain("Стек");
    expect(text).not.toContain("Marker");
  });

  it("digest лише як короткий токен; дивна назва помилки — «Error»", () => {
    const withDigest = Object.assign(new Error("boom"), { digest: "1234567890" });
    expect(errorDigest(withDigest)).toBe("1234567890");
    expect(errorDigest(Object.assign(new Error("boom"), { digest: SECRET }))).toBe("");
    const weird = new Error("boom");
    weird.name = SECRET;
    expect(errorName(weird)).toBe("Error");
  });

  it("невідомий метод не друкується як є", () => {
    expect(formatErrorAlert({ ...base, method: SECRET })).toContain("Маршрут: ? /clients/new");
  });
});

describe("envLabel і shouldSend", () => {
  it("APP_ENV важливіший за VERCEL_ENV; без обох — local; вільний текст — invalid", () => {
    expect(envLabel("staging", "preview")).toBe("staging");
    expect(envLabel(undefined, "production")).toBe("production");
    expect(envLabel(" ", undefined)).toBe("local");
    expect(envLabel("staging; rm", "preview")).toBe("invalid");
  });

  it("та сама помилка на тому самому маршруті — не частіше разу на хвилину", () => {
    const sent = new Map<string, number>();
    expect(shouldSend(sent, "/a|d1", 1_000)).toBe(true);
    expect(shouldSend(sent, "/a|d1", 1_000 + SAME_ERROR_PAUSE_MS - 1)).toBe(false);
    expect(shouldSend(sent, "/b|d1", 1_500)).toBe(true);
    expect(shouldSend(sent, "/a|d1", 1_000 + SAME_ERROR_PAUSE_MS)).toBe(true);
  });
});

describe("/api/ops/error-check", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    viewer.calls = 0;
  });

  it("на проді — 404 ще до перевірки входу, навіть з APP_ENV=staging", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    viewer.role = "admin";
    const { GET } = await import("@/app/api/ops/error-check/route");
    expect((await GET()).status).toBe(404);
    expect(viewer.calls).toBe(0);
  });

  it("поза preview і staging (локально без VERCEL_ENV, development) — 404 ще до перевірки входу", async () => {
    viewer.role = "admin";
    const { GET } = await import("@/app/api/ops/error-check/route");
    for (const env of ["", "development"]) {
      vi.stubEnv("VERCEL_ENV", env);
      vi.stubEnv("APP_ENV", "");
      expect((await GET()).status).toBe(404);
    }
    expect(viewer.calls).toBe(0);
  });

  it("APP_ENV=staging без VERCEL_ENV=preview — дозволено адміністратору", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "staging");
    viewer.role = "admin";
    const { GET } = await import("@/app/api/ops/error-check/route");
    await expect(GET()).rejects.toThrow("ops error-check: intentional server error");
  });

  it("на preview не адміністратору — 404", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { GET } = await import("@/app/api/ops/error-check/route");
    for (const role of ["scheduler", "therapist", null]) {
      viewer.role = role;
      expect((await GET()).status).toBe(404);
    }
  });

  it("на preview адміністратору — навмисна помилка без даних користувача", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    viewer.role = "admin";
    const { GET } = await import("@/app/api/ops/error-check/route");
    await expect(GET()).rejects.toThrow("ops error-check: intentional server error");
  });
});
