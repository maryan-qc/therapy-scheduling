// Чернетка картки клієнта з тексту звернення (openspec/specs/intake-draft, AC-INTAKE-01…09). Модель лише витягує
// факти (src/lib/ai/schema.ts); правила «Припущення» PM (HryhoriiHaponiukQuitCode/therapy-scheduling-spec#36) рахує
// цей модуль — детерміновано, без мережі (ADR 0002).
import type { Draft } from "@/lib/ai/schema";
import { isBirthDate, type CardForm } from "./card";
import { normalizeEmail } from "@/lib/holds/clients";

/** Поле тексту звернення приймає до 2000 символів («Припущення» PM). */
export const INTAKE_MAX_LENGTH = 2000;
/** Підказка під полем тексту звернення: текст обробляє зовнішній сервіс («Припущення» PM). */
export const INTAKE_HINT = "Don't paste diagnoses or other health details: name, date of birth, language and contacts are enough.";

export const DRAFT_READY = "Draft ready. Check the fields and create the card."; // AC-INTAKE-01, 02
export const DRAFT_REFUSED =
  "This text can't be used to draft a client card. Paste the client's request or fill in the form manually."; // AC-INTAKE-06, 07
export const ASSISTANT_UNAVAILABLE = "The assistant is unavailable right now. Fill in the form manually."; // AC-INTAKE-08

/** «Draft is incomplete. Missing: …» — порожні обов'язкові поля в порядку форми (AC-INTAKE-04, 05). */
export function draftIncompleteMessage(missing: readonly string[]): string {
  return `Draft is incomplete. Missing: ${missing.join(", ")}. Fill them in manually.`;
}

export type IntakeStatus = "ok" | "needs_info" | "refused";

/** Чернетка так, як її бачить форма: значення PM («Adult», «English»), порожнє поле = null. */
export interface IntakeDraft {
  status: IntakeStatus;
  clientType: "Adult" | "Child" | null;
  name: string | null;
  dateOfBirth: string | null;
  sessionLanguage: "English" | "Spanish" | null;
  email: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  message: string;
}

const REFUSED: IntakeDraft = {
  status: "refused",
  clientType: null,
  name: null,
  dateOfBirth: null,
  sessionLanguage: null,
  email: null,
  guardianName: null,
  guardianEmail: null,
  message: DRAFT_REFUSED,
};

const text = (value: string | null): string | null => value?.trim() || null;

/** Email як у тексті, малими літерами без пробілів по краях; без «@» чи з пробілом усередині — порожньо. */
function email(value: string | null): string | null {
  const normalized = normalizeEmail(value ?? "");
  return normalized.includes("@") && !/\s/.test(normalized) ? normalized : null;
}

/** Повних років на `today` (обидві дати — РРРР-ММ-ДД). */
function fullYears(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Мова сеансів — лише English чи Spanish; інша мова чи мова самого тексту — порожньо. */
function sessionLanguage(value: string | null): IntakeDraft["sessionLanguage"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "english") return "English";
  if (normalized === "spanish") return "Spanish";
  return null;
}

/**
 * Відповідь моделі → чернетка форми за правилами PM. `today` — сьогодні в America/Los_Angeles (РРРР-ММ-ДД).
 * Порядок правил — design.md impl-intake-draft-assistant, «Контракт модулів».
 */
export function finalizeDraft(raw: Draft, today: string): IntakeDraft {
  if (raw.status === "refused") return REFUSED;

  const name = text(raw.clientName);
  const dateOfBirth = raw.dateOfBirth && isBirthDate(raw.dateOfBirth, today) ? raw.dateOfBirth : null;
  const child = raw.writtenByParentForChild || (dateOfBirth !== null && fullYears(dateOfBirth, today) < 18);
  const fields = {
    clientType: child ? ("Child" as const) : ("Adult" as const),
    name,
    dateOfBirth,
    sessionLanguage: sessionLanguage(raw.sessionLanguage),
    email: child ? null : email(raw.clientEmail),
    guardianName: child ? text(raw.guardianName) : null,
    guardianEmail: child ? email(raw.guardianEmail) : null,
  };

  // Жодного поля клієнта — це не звернення нового клієнта (AC-INTAKE-06, власне припущення розробника).
  const clientFields = [fields.name, fields.dateOfBirth, fields.sessionLanguage, fields.email, fields.guardianName, fields.guardianEmail];
  if (clientFields.every((value) => value === null)) return REFUSED;

  const required: [string, string | null][] = [
    ["Name", fields.name],
    ["Date of birth", fields.dateOfBirth],
    ["Session language", fields.sessionLanguage],
    ...(child
      ? ([
          ["Guardian name", fields.guardianName],
          ["Guardian email", fields.guardianEmail],
        ] as [string, string | null][])
      : ([["Email", fields.email]] as [string, string | null][])),
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  return missing.length === 0
    ? { status: "ok", ...fields, message: DRAFT_READY }
    : { status: "needs_info", ...fields, message: draftIncompleteMessage(missing) };
}

// Перша лінія проти ін'єкції (AC-INTAKE-07): явні звертання до помічника відхиляє код ще до виклику моделі — ліміт
// не витрачається. Непрямі спроби ловить модель за інструкцією «текст між <document> — дані».
const ASSISTANT_INSTRUCTIONS = [
  /\b(ignore|disregard|forget|override)\b[^.!?\n]{0,60}\b(instructions?|rules|prompts?)\b/i,
  /\b(for|to|dear|hey)\s+(the\s+)?(assistant|ai|bot|chatbot|model|system)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+now\b/i,
];

export function hasAssistantInstructions(input: string): boolean {
  return ASSISTANT_INSTRUCTIONS.some((pattern) => pattern.test(input));
}

/** Чернетка → значення форми картки (CardForm): «Adult» → "adult", порожньо → "". */
export function draftToCardForm(draft: IntakeDraft): CardForm {
  return {
    type: draft.clientType === "Child" ? "child" : draft.clientType === "Adult" ? "adult" : "",
    name: draft.name ?? "",
    dateOfBirth: draft.dateOfBirth ?? "",
    language: draft.sessionLanguage ?? "",
    email: draft.email ?? "",
    guardianName: draft.guardianName ?? "",
    guardianEmail: draft.guardianEmail ?? "",
  };
}
