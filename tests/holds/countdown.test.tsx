// Відлік після «Held until …» (DESIGN.md, розділ 6): перший рендер — з часом сервера, тож HTML сервера й клієнта
// збігаються. Оновлення щохвилини й перечитування сторінки після кінця — ефекти браузера, тут їх немає.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { HoldCountdown } = await import("@/app/_components/hold-countdown");

const NOW = Date.parse("2026-11-04T18:00:00.000Z");
const html = (until: string) => renderToStaticMarkup(<HoldCountdown until={until} now={NOW} />);

describe("відлік утримання", () => {
  it("рахує від часу сервера, а не від годинника тесту", () => {
    expect(html("2026-11-05T18:00:00.000Z")).toContain(" · 24 h left");
    expect(html("2026-11-04T21:12:30.000Z")).toContain(" · 3 h 12 min left");
  });

  it("менше години — теплий колір статусу Held, інакше — приглушений", () => {
    expect(html("2026-11-04T18:45:00.000Z")).toContain("text-status-held-foreground");
    expect(html("2026-11-04T18:45:00.000Z")).toContain(" · 45 min left");
    expect(html("2026-11-04T19:00:00.000Z")).toContain("text-muted-foreground");
  });

  it("час вийшов — «expired»", () => {
    expect(html("2026-11-04T17:59:00.000Z")).toContain(" · expired");
  });
});
