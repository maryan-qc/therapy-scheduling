// Куди ведуть дії слотів після утримання й підтвердження (src/app/slots/actions.ts): поле back форми — недовірений
// вхід (дію можна викликати напряму, оминаючи сторінку). Повернення — лише на свій сайт, на /slots чи /holds; інакше
// open redirect: «/slots/../..//evil.example» після нормалізації стає «//evil.example» — чужий сайт.
// Сесію (requireViewer), Supabase і навігацію Next підмінено; правила утримання й підтвердження — у tests/db/.
import { beforeEach, describe, expect, it, vi } from "vitest";

const SLOT = "5a0c1d2e-0000-4000-8000-000000000001";
const CLIENT = "6f0c1d2e-0000-4000-8000-000000000006";
const HOLD = "7b0c1d2e-0000-4000-8000-000000000007";
const THERAPIST = "8c0c1d2e-0000-4000-8000-000000000008";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  viewer: vi.fn(),
  // Як справжній redirect Next: кидає, і код після нього не виконується.
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("@/lib/supabase/viewer", () => ({ requireViewer: mocks.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { confirmHold, holdSlot } = await import("@/app/slots/actions");

const HOSTILE_BACKS = [
  "/slots/../..//evil.example",
  "/holds/..//evil.example",
  "/slots/%2e%2e//evil.example",
  "https://evil.example",
  "//evil.example",
  "/slotsevil",
  "/holds/../admin",
];

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

/** Адреса, на яку дія перенаправила (redirect кидає, як у Next). */
async function redirectedTo(action: (data: FormData) => Promise<void>, data: FormData): Promise<string> {
  await expect(action(data)).rejects.toThrow(/^REDIRECT /);
  expect(mocks.redirect).toHaveBeenCalledTimes(1);
  return String(mocks.redirect.mock.calls[0][0]);
}

/** Повернення — на свій сайт, рівно на /slots чи /holds; повертає розібрану адресу для подальших перевірок. */
function expectSameOriginSchedule(to: string): URL {
  expect(to.startsWith("//"), to).toBe(false);
  const url = new URL(to, "http://local");
  expect(url.origin, to).toBe("http://local");
  expect(["/slots", "/holds"], to).toContain(url.pathname);
  return url;
}

const holdForm = (back: string) => form({ slot_id: SLOT, client_id: CLIENT, back });
const confirmForm = (back: string) => form({ hold_id: HOLD, back });

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.redirect.mockClear();
  mocks.viewer.mockReset();
  mocks.viewer.mockResolvedValue({ role: "scheduler", supabase: { rpc: mocks.rpc } });
});

describe("holdSlot: повернення після утримання", () => {
  it.each(HOSTILE_BACKS)(
    "AC-HOLD-02: back=%s — після утримання лише на свій /slots (з ok=hold.OK), не на чужий сайт",
    async (back) => {
      mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
      const url = expectSameOriginSchedule(await redirectedTo(holdSlot, holdForm(back)));
      expect(url.pathname).toBe("/slots");
      expect(url.searchParams.get("ok")).toBe("hold.OK");
    },
  );

  it.each(HOSTILE_BACKS)(
    "AC-HOLD-02: back=%s — відмова бази (SLOT_UNAVAILABLE) теж лише на свій /slots",
    async (back) => {
      mocks.rpc.mockResolvedValue({ data: { code: "SLOT_UNAVAILABLE" }, error: null });
      const url = expectSameOriginSchedule(await redirectedTo(holdSlot, holdForm(back)));
      expect(url.pathname).toBe("/slots");
      expect(url.searchParams.get("error")).toBe("hold.SLOT_UNAVAILABLE");
    },
  );

  it.each(HOSTILE_BACKS)(
    "AC-HOLD-02: back=%s — без клієнта у формі (до бази) теж лише на свій /slots",
    async (back) => {
      const url = expectSameOriginSchedule(await redirectedTo(holdSlot, form({ slot_id: SLOT, back })));
      expect(url.pathname).toBe("/slots");
      expect(url.searchParams.get("error")).toBe("hold.CLIENT_REQUIRED");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("AC-HOLD-02: справжня адреса дня слотів зберігає день і терапевта", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
    const back = `/slots?day=2026-11-20&therapist=${THERAPIST}`;
    const url = expectSameOriginSchedule(await redirectedTo(holdSlot, holdForm(back)));
    expect(url.pathname).toBe("/slots");
    expect(url.searchParams.get("day")).toBe("2026-11-20");
    expect(url.searchParams.get("therapist")).toBe(THERAPIST);
    expect(url.searchParams.get("ok")).toBe("hold.OK");
  });

  it("AC-HOLD-02: справжня адреса /holds лишається /holds", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
    const url = expectSameOriginSchedule(await redirectedTo(holdSlot, holdForm("/holds")));
    expect(url.pathname).toBe("/holds");
    expect(url.searchParams.get("ok")).toBe("hold.OK");
  });
});

describe("confirmHold: повернення після підтвердження", () => {
  it.each(HOSTILE_BACKS)(
    "AC-HOLD-12: back=%s — після підтвердження лише на свій /slots (з ok=confirm.OK), не на чужий сайт",
    async (back) => {
      mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
      const url = expectSameOriginSchedule(await redirectedTo(confirmHold, confirmForm(back)));
      expect(url.pathname).toBe("/slots");
      expect(url.searchParams.get("ok")).toBe("confirm.OK");
    },
  );

  it.each(HOSTILE_BACKS)(
    "AC-HOLD-12: back=%s — відмова бази (HOLD_EXPIRED) теж лише на свій /slots",
    async (back) => {
      mocks.rpc.mockResolvedValue({ data: { code: "HOLD_EXPIRED" }, error: null });
      const url = expectSameOriginSchedule(await redirectedTo(confirmHold, confirmForm(back)));
      expect(url.pathname).toBe("/slots");
      expect(url.searchParams.get("error")).toBe("confirm.HOLD_EXPIRED");
    },
  );

  it("AC-HOLD-12: справжня адреса /holds лишається /holds", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
    const url = expectSameOriginSchedule(await redirectedTo(confirmHold, confirmForm("/holds")));
    expect(url.pathname).toBe("/holds");
    expect(url.searchParams.get("ok")).toBe("confirm.OK");
  });

  it("AC-HOLD-12: справжня адреса дня слотів зберігає день і терапевта", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
    const back = `/slots?day=2026-11-20&therapist=${THERAPIST}`;
    const url = expectSameOriginSchedule(await redirectedTo(confirmHold, confirmForm(back)));
    expect(url.pathname).toBe("/slots");
    expect(url.searchParams.get("day")).toBe("2026-11-20");
    expect(url.searchParams.get("therapist")).toBe(THERAPIST);
  });
});
