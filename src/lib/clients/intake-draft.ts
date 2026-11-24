// Оркестрація чернетки картки (openspec/specs/intake-draft): роль → запобіжники → модель → правила PM.
// Без мережі, бази й process.env: модель і «сьогодні» — параметрами, тож тести й живий eval проганяють той самий шлях,
// що й Server Action `requestIntakeDraft`. Помічник нічого не пише: у цього модуля немає клієнта бази (AC-INTAKE-03, 07).
import type { LanguageModel } from "ai";
import { proposeDraft, type DraftOptions } from "@/lib/ai/draft";
import { logLlmCall } from "@/lib/ai/llm-log";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import type { Role } from "@/lib/holds/types";
import { CARD_MESSAGES, cardRoleError } from "./card";
import { ASSISTANT_UNAVAILABLE, DRAFT_REFUSED, finalizeDraft, hasAssistantInstructions, type IntakeDraft } from "./intake";

export type IntakeDraftResponse =
  | { kind: "draft"; draft: IntakeDraft } // status ok або needs_info — форма замінюється чернеткою
  | { kind: "refused" | "unavailable" | "forbidden"; message: string }; // форма не змінюється

export async function draftIntake(args: {
  role: Role | null;
  text: string;
  model: LanguageModel | null;
  today: string;
  options?: DraftOptions;
}): Promise<IntakeDraftResponse> {
  // 1. Роль — до будь-якого звернення до моделі: терапевт не витрачає ліміт і нічого не отримує (AC-INTAKE-09).
  const roleError = cardRoleError(args.role);
  if (roleError) return { kind: "forbidden", message: CARD_MESSAGES[roleError] };

  // 2. Порожній текст чи явні вказівки помічнику — відмова без виклику моделі (AC-INTAKE-06, 07).
  if (!args.text.trim() || hasAssistantInstructions(args.text)) return { kind: "refused", message: DRAFT_REFUSED };

  // 3. Немає ключа, 429, тайм-аут, відповідь не за схемою, помилка постачальника — «недоступний» (AC-INTAKE-08).
  // Без ключа модель не викликаємо, але рядок llm.call пишемо: інакше «помічник недоступний» через забутий ключ
  // (напр. на staging) не видно ні в health, ні в smoke, ні в трекері помилок (WS11 B, тиха деградація).
  if (!args.model) {
    const log = args.options?.log;
    if (log) {
      logLlmCall({
        requestId: log.requestId,
        route: log.route,
        model: log.primaryModel,
        fallbackUsed: false,
        state: "unavailable",
        latencyMs: 0,
        promptVersion: DRAFT_PROMPT_VERSION,
        errorKind: "no_api_key",
      });
    }
    return { kind: "unavailable", message: ASSISTANT_UNAVAILABLE };
  }
  const result = await proposeDraft({ text: args.text }, args.model, args.options);
  if (!result.ok) return { kind: "unavailable", message: ASSISTANT_UNAVAILABLE };

  // 4. Правила PM рахує код (AC-INTAKE-01, 02, 04, 05, 06).
  const draft = finalizeDraft(result.draft, args.today);
  return draft.status === "refused" ? { kind: "refused", message: draft.message } : { kind: "draft", draft };
}
