// Сама Server Action createClientCard (src/app/clients/actions.ts): її можна викликати напряму, оминаючи сторінку,
// тож перевіряємо порядок у дії — роль → форма → запис. Сесію (requireViewer), Supabase і навігацію Next підмінено:
// RLS і check-обмеження бази — окремо, у tests/db/client-cards.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardForm } from "@/lib/clients/card";

const mocks = vi.hoisted(() => ({
  role: "scheduler" as string | null,
  from: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/viewer", () => ({
  requireViewer: async () => ({ role: mocks.role, supabase: { from: mocks.from } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { createClientCard } = await import("@/app/clients/actions");

const EMPTY = { errors: [], values: {} as CardForm };

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const clientSix = {
  type: "adult",
  name: "Client Six",
  email: "client6@example.test",
  date_of_birth: "1990-05-14",
  session_language: "English",
};

beforeEach(() => {
  mocks.from.mockReset();
  mocks.insert.mockReset();
  mocks.redirect.mockReset();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: "card-6" }, error: null }) }),
  });
});

describe("дія createClientCard", () => {
  it("AC-CARD-06: therapist1 викликає дію напряму — «Only schedulers and admins can create client cards.», запису немає", async () => {
    mocks.role = "therapist";

    const state = await createClientCard(EMPTY, formData(clientSix));

    expect(state.errors).toEqual(["CARD_FORBIDDEN"]);
    expect(mocks.from).not.toHaveBeenCalled(); // до бази дія не дійшла
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("AC-CARD-03: дитина без імені опікуна — відмова без запису, усі введені дані повертаються у форму", async () => {
    mocks.role = "scheduler";
    const fields = {
      type: "child",
      name: "Client Eight",
      date_of_birth: "2016-01-10",
      session_language: "English",
      guardian_name: "",
      guardian_email: "guardian8@example.test",
    };

    const state = await createClientCard(EMPTY, formData(fields));

    expect(state.errors).toEqual(["GUARDIAN_INVALID"]);
    expect(state.values).toMatchObject({
      type: "child",
      name: "Client Eight",
      dateOfBirth: "2016-01-10",
      language: "English",
      guardianName: "",
      guardianEmail: "guardian8@example.test",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("AC-CARD-01: планувальник — картку записано його клієнтом Supabase, далі сторінка нової картки", async () => {
    mocks.role = "scheduler";

    await createClientCard(EMPTY, formData(clientSix));

    expect(mocks.from).toHaveBeenCalledWith("clients");
    expect(mocks.insert).toHaveBeenCalledWith({
      client_type: "adult",
      name: "Client Six",
      email: "client6@example.test",
      date_of_birth: "1990-05-14",
      session_language: "English",
      guardian_name: null,
      guardian_email: null,
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/clients/card-6?ok=created");
  });
});
