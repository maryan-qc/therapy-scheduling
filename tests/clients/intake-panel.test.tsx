// Панель «Draft from the client's request» над формою нової картки (openspec/specs/intake-draft; розмітка —
// design.md зміни impl-intake-draft-assistant, «UI і компоненти»). Дію чернетки передано пропом requestDraft, тож власні
// модулі не мокаємо. Підмінено лише сесію (requireViewer — адаптер Supabase), навігацію Next і маркер server-only:
// форма імпортує src/app/clients/actions.ts, а та — обгортку моделі з import "server-only".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClientCardForm } from "@/app/clients/new/card-form";
import { IntakeDraftPanel } from "@/app/clients/new/intake-draft-panel";
import NewClientCardPage from "@/app/clients/new/page";
import { CARD_MESSAGES } from "@/lib/clients/card";
import { INTAKE_HINT, INTAKE_MAX_LENGTH } from "@/lib/clients/intake";
import type { IntakeDraftResponse } from "@/lib/clients/intake-draft";

const mocks = vi.hoisted(() => ({ role: "scheduler" as string | null }));

vi.mock("server-only", () => ({}));
// Клієнт Supabase без жодного методу: будь-яке звернення сторінки до бази впаде.
vi.mock("@/lib/supabase/viewer", () => ({
  requireViewer: async () => ({ role: mocks.role, email: "user@example.test", supabase: {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const requestDraft = async (): Promise<IntakeDraftResponse> => ({ kind: "unavailable", message: "" });

/** Текст так, як його екранує renderToStaticMarkup. */
const escaped = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");

/** Текст елемента без тегів усередині. */
const textOf = (inner: string) => inner.replace(/<[^>]+>/g, "").trim();

/** Внутрішній вміст елемента з цим id (перший тег з таким id і його закривний тег). */
function innerById(html: string, id: string): string | undefined {
  return new RegExp(`<(\\w+)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html)?.[2];
}

/** Поле тексту звернення: відкривний тег <textarea id="intake-text" …>. */
function intakeTextarea(html: string): string {
  return /<textarea\b[^>]*\bid="intake-text"[^>]*>/.exec(html)?.[0] ?? "";
}

/** Текст усіх елементів, на які посилається aria-describedby поля. */
function describedBy(html: string, tag: string): string {
  const ids = /\baria-describedby="([^"]+)"/.exec(tag)?.[1].split(/\s+/) ?? [];
  return ids.map((id) => textOf(innerById(html, id) ?? "")).join(" ");
}

/** Підписи всіх кнопок. */
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => textOf(m[1]));

/** Підпис поля за for=… */
const labelFor = (html: string, id: string) =>
  textOf(new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>([\\s\\S]*?)</label>`).exec(html)?.[1] ?? "");

/** Усі файли теки (рекурсивно); теки немає — порожньо. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

/** Усі <form>…</form> сторінки (вкладених форм у HTML не буває). */
const forms = (html: string) => [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]);

describe("панель чернетки з тексту звернення", () => {
  it("AC-INTAKE-01: поле «Client's request» до 2000 символів з підказкою PM (aria-describedby) і кнопка «Draft card from request»", () => {
    const html = renderToStaticMarkup(<IntakeDraftPanel requestDraft={requestDraft} onDraft={() => {}} />);
    const textarea = intakeTextarea(html);

    expect(textarea).not.toBe("");
    expect(INTAKE_MAX_LENGTH).toBe(2000);
    expect(textarea).toMatch(/\bmaxlength="2000"/i); // React рендерить maxLength; назви атрибутів HTML — без регістру
    expect(labelFor(html, "intake-text")).toBe(escaped("Client's request"));
    expect(describedBy(html, textarea)).toContain(escaped(INTAKE_HINT));
    expect(escaped(INTAKE_HINT)).toBe(
      "Don&#x27;t paste diagnoses or other health details: name, date of birth, language and contacts are enough.",
    );
    expect(buttons(html)).toContain("Draft card from request");
    // До запиту повідомлень результату немає.
    expect(html).not.toContain("Draft ready.");
    expect(html).not.toContain("The assistant is unavailable right now.");
  });

  it("AC-INTAKE-03: панель — над формою картки, але поза нею: скласти чернетку й створити картку — різні дії", () => {
    const html = renderToStaticMarkup(<ClientCardForm today="2026-11-13" requestDraft={requestDraft} />);
    const cardForm = forms(html).find((form) => form.includes("Create client card"));

    expect(intakeTextarea(html)).not.toBe("");
    expect(buttons(html)).toEqual(expect.arrayContaining(["Draft card from request", "Create client card"]));
    expect(cardForm).toBeDefined();
    // Текст звернення не йде в createClientCard, а кнопка чернетки не надсилає форму картки.
    expect(cardForm).not.toContain('id="intake-text"');
    expect(cardForm).not.toContain('name="intake_text"');
    expect(cardForm).not.toContain("Draft card from request");
    expect(html.indexOf('id="intake-text"')).toBeLessThan(html.indexOf("Create client card"));
  });

  it("AC-INTAKE-03: помічник не має шляху до запису — intake.ts, intake-draft.ts і src/lib/ai/** нічого не імпортують із Supabase", () => {
    const root = process.cwd();
    const files = [
      path.join(root, "src/lib/clients/intake.ts"),
      path.join(root, "src/lib/clients/intake-draft.ts"),
      ...walk(path.join(root, "src/lib/ai")),
    ]
      .filter((file) => existsSync(file))
      .map((file) => ({ rel: path.relative(root, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));

    expect(files.map((file) => file.rel)).toEqual(
      expect.arrayContaining([
        "src/lib/clients/intake.ts",
        "src/lib/clients/intake-draft.ts",
        "src/lib/ai/schema.ts",
        "src/lib/ai/draft.ts",
        "src/lib/ai/prompts/draft.ts",
      ]),
    );
    const SUPABASE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'][^"']*supabase[^"']*["']/i;
    expect(files.filter((file) => SUPABASE_IMPORT.test(file.text)).map((file) => file.rel)).toEqual([]);
  });
});

describe("сторінка /clients/new за роллю", () => {
  it("AC-INTAKE-09: терапевт бачить лише «Only schedulers and admins can create client cards.» — без форми й без панелі чернетки", async () => {
    mocks.role = "therapist";
    const html = renderToStaticMarkup(await NewClientCardPage());

    expect(html).toContain(CARD_MESSAGES.CARD_FORBIDDEN);
    expect(html).not.toContain('id="intake-text"');
    expect(html).not.toContain(escaped("Client's request"));
    expect(html).not.toContain("Draft card from request");
    expect(html).not.toContain("Create client card");
  });

  it("AC-INTAKE-09: планувальнику та сама сторінка показує форму картки й панель чернетки", async () => {
    for (const role of ["scheduler", "admin"]) {
      mocks.role = role;
      const html = renderToStaticMarkup(await NewClientCardPage());

      expect(html).not.toContain(CARD_MESSAGES.CARD_FORBIDDEN);
      expect(intakeTextarea(html)).not.toBe("");
      expect(buttons(html)).toEqual(expect.arrayContaining(["Draft card from request", "Create client card"]));
    }
  });
});
