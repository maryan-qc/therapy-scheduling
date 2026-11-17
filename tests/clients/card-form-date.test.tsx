// Поле Date of birth форми нової картки — у форматі РРРР-ММ-ДД, як у «Тоді» AC-INTAKE-01/02 («Date of birth —
// 1990-05-14») і «Вигляд і тон» PM. Зауваження PM при прийманні зрізу 4 (PR #53): вбудоване поле дати браузера
// показувало дату в локальному форматі (19.08.2015). Тож поле — текстове, з підказкою формату під ним; перевірка дати на
// сервері (validateClientCard) не змінюється. Підмінено лише сесію, навігацію Next і маркер server-only — як у
// tests/clients/intake-panel.test.tsx.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClientCardForm } from "@/app/clients/new/card-form";
import type { IntakeDraftResponse } from "@/lib/clients/intake-draft";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/viewer", () => ({
  requireViewer: async () => ({ role: "scheduler", email: "user@example.test", supabase: {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const requestDraft = async (): Promise<IntakeDraftResponse> => ({ kind: "unavailable", message: "" });

/** Відкривний тег поля Date of birth: <input id="card-dateOfBirth" …>. */
function dateInput(html: string): string {
  return /<input\b[^>]*\bid="card-dateOfBirth"[^>]*>/.exec(html)?.[0] ?? "";
}

/** Значення атрибута (назви атрибутів HTML — без регістру: React рендерить maxLength, inputMode). */
function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1];
}

/** Тип поля так, як його бачить браузер: без атрибута type — text. */
const inputType = (tag: string) => attr(tag, "type") ?? "text";

/** Текст елемента з цим id без тегів усередині. */
function textById(html: string, id: string): string | undefined {
  return new RegExp(`<(\\w+)\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html)?.[2].replace(/<[^>]+>/g, "").trim();
}

describe("поле Date of birth форми нової картки", () => {
  it("AC-INTAKE-01: Date of birth — текстове поле РРРР-ММ-ДД, а не вбудоване поле дати браузера, з підказкою «Format: YYYY-MM-DD»", () => {
    const html = renderToStaticMarkup(<ClientCardForm today="2026-11-13" requestDraft={requestDraft} />);
    const input = dateInput(html);

    expect(input, "поля id=card-dateOfBirth немає").not.toBe("");
    expect(attr(input, "name")).toBe("date_of_birth");
    expect(html).not.toMatch(/\stype="date"/i);
    expect(inputType(input)).toBe("text");
    expect(attr(input, "inputmode")).toBe("numeric");
    expect(attr(input, "placeholder")).toBe("YYYY-MM-DD");
    expect(attr(input, "maxlength")).toBe("10");
    expect(attr(input, "pattern")).toBe(String.raw`\d{4}-\d{2}-\d{2}`);
    // Видима підказка формату під полем, пов'язана з ним (доки помилки немає — лише вона).
    expect(textById(html, "card-dateOfBirth-format")).toBe("Format: YYYY-MM-DD");
    expect(attr(input, "aria-describedby")?.split(/\s+/)).toContain("card-dateOfBirth-format");
  });
});
