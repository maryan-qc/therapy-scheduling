// Що бачить кожна роль на сторінках зрізу 2: самі серверні сторінки рендеряться в HTML з підміненими сесією
// (requireViewer) і клієнтом Supabase, який повертає порожні дані. Так тест ловить і неправильну гілку сторінки, а не
// лише значення тексту. RLS і дані — окремо, у tests/db/.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "scheduler" as string | null, calls: [] as string[] }));

/** Клієнт Supabase, у якому будь-який ланцюжок запиту дає порожню відповідь; записує, до яких таблиць зверталися. */
function emptySupabase() {
  const result = { data: [], error: null };
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
        if (prop === "maybeSingle") return () => Promise.resolve({ data: null, error: null });
        return () => builder;
      },
    },
  );
  return {
    from: (table: string) => {
      mocks.calls.push(table);
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/viewer", () => ({
  requireViewer: async () => ({ role: mocks.role, email: "user@example.test", supabase: emptySupabase() }),
}));
vi.mock("@/app/_components/nav", () => ({ Nav: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { default: ClientsPage } = await import("@/app/clients/page");
const { default: ClientCardPage } = await import("@/app/clients/[id]/page");
const { default: SlotsPage } = await import("@/app/slots/page");
const { default: HoldsPage } = await import("@/app/holds/page");

const html = (element: React.ReactNode) => renderToStaticMarkup(element);
const MISSING = "00000000-0000-0000-0000-000000000016";
const cardPage = () =>
  ClientCardPage({ params: Promise.resolve({ id: MISSING }), searchParams: Promise.resolve({}) } as never);

beforeEach(() => {
  mocks.calls = [];
});

describe("сторінки зрізу 2 за роллю", () => {
  it("AC-CARD-15: планувальник і адміністратор без жодної картки бачать «No clients yet. Create a client card from an intake form.»", async () => {
    for (const role of ["scheduler", "admin"]) {
      mocks.role = role;
      const page = html(await ClientsPage());
      expect(page).toContain("No clients yet. Create a client card from an intake form.");
      expect(page).toContain("New client card");
    }
  });

  it("AC-CARD-09: терапевт без своїх клієнтів бачить «No clients yet. Clients appear here when a scheduler holds a slot with you.»", async () => {
    mocks.role = "therapist";
    const page = html(await ClientsPage());

    expect(page).toContain("No clients yet. Clients appear here when a scheduler holds a slot with you.");
    expect(page).not.toContain("Create a client card from an intake form.");
  });

  it("AC-CARD-16: картки немає — планувальник «This client card doesn't exist.», терапевт «You don't have access to this client.»", async () => {
    mocks.role = "scheduler";
    expect(html(await cardPage())).toContain("This client card doesn&#x27;t exist.");
    mocks.role = "therapist";
    const therapistPage = html(await cardPage());
    expect(therapistPage).toContain("You don&#x27;t have access to this client.");
    expect(therapistPage).not.toContain("doesn&#x27;t exist");
  });

  it("AC-HOLD-44: терапевт на /slots і /holds бачить лише «Only schedulers and admins can view this page.», без запитів до бази", async () => {
    mocks.role = "therapist";
    const slots = html(await SlotsPage({ searchParams: Promise.resolve({}) } as never));
    const holds = html(await HoldsPage({ searchParams: Promise.resolve({}) } as never));

    expect(slots).toContain("Only schedulers and admins can view this page.");
    expect(holds).toContain("Only schedulers and admins can view this page.");
    expect(mocks.calls).toEqual([]);
  });

  it("AC-HOLD-44: планувальник на /slots відмови не бачить", async () => {
    mocks.role = "scheduler";
    const slots = html(await SlotsPage({ searchParams: Promise.resolve({}) } as never));

    expect(slots).not.toContain("Only schedulers and admins can view this page.");
    expect(mocks.calls).toContain("clients");
  });
});
