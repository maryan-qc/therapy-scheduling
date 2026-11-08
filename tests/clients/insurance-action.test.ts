// Сама Server Action setInsuranceStatus (src/app/clients/actions.ts): її можна викликати напряму, оминаючи сторінку.
// Перевіряємо, що дія передає функції бази саме те, що прийшло з форми, і куди веде результат. Сесію (requireViewer),
// Supabase і навігацію Next підмінено: хто може змінювати статус, вирішує база — tests/db/insurance-status.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT = "6f0c1d2e-0000-4000-8000-000000000006";

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

const { setInsuranceStatus } = await import("@/app/clients/actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.redirect.mockClear();
  mocks.viewer.mockReset();
  mocks.viewer.mockResolvedValue({ role: "scheduler", supabase: { rpc: mocks.rpc } });
});

describe("дія setInsuranceStatus", () => {
  it("AC-INS-02: планувальник — RPC з тим самим client_id і статусом, далі картка з «Insurance status saved.»", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "OK" }, error: null });
    await expect(setInsuranceStatus(form({ client_id: CLIENT, insurance_status: "verified" }))).rejects.toThrow(
      `REDIRECT /clients/${CLIENT}?ok=insurance`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("set_insurance_status", { p_client_id: CLIENT, p_status: "verified" });
  });

  it("AC-INS-05: терапевт викликає дію напряму — база відмовляє, дія веде на картку з відмовою", async () => {
    mocks.viewer.mockResolvedValue({ role: "therapist", supabase: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ data: { code: "INSURANCE_FORBIDDEN" }, error: null });
    await expect(setInsuranceStatus(form({ client_id: CLIENT, insurance_status: "verified" }))).rejects.toThrow(
      `REDIRECT /clients/${CLIENT}?error=INSURANCE_FORBIDDEN`,
    );
  });

  it("AC-INS-05: без статусу у формі до бази йде порожній статус, і база його відхиляє («Not set» не повертається)", async () => {
    mocks.rpc.mockResolvedValue({ data: { code: "INVALID_STATUS" }, error: null });
    await expect(setInsuranceStatus(form({ client_id: CLIENT }))).rejects.toThrow(
      `REDIRECT /clients/${CLIENT}?error=INVALID_STATUS`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("set_insurance_status", { p_client_id: CLIENT, p_status: "" });
  });

  it("AC-INS-06: без входу requireViewer веде на /login — RPC не викликано; некоректний id — на список, без бази", async () => {
    mocks.viewer.mockImplementation(async () => mocks.redirect("/login"));
    await expect(setInsuranceStatus(form({ client_id: CLIENT, insurance_status: "verified" }))).rejects.toThrow(
      "REDIRECT /login",
    );
    await expect(setInsuranceStatus(form({ client_id: "not-a-uuid", insurance_status: "verified" }))).rejects.toThrow(
      "REDIRECT /clients",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
