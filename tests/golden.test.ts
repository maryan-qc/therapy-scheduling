import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { Draft } from "@/lib/ai/schema";
import { DRAFT_PROMPT_VERSION, wrapDocument } from "@/lib/ai/prompts/draft";
import { scoreFields, type GoldenCase } from "@/lib/ai/scorer";
import { DRAFT_REFUSED, hasAssistantInstructions, type IntakeDraft } from "@/lib/clients/intake";
import { draftIntake, type IntakeDraftResponse } from "@/lib/clients/intake-draft";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";

// Офлайн-реплей golden cases PM (tests/fixtures/golden/cases.json, GC-01…10): без мережі й без ключа, тож працює в CI
// (`npm test`, job `app`). Записана відповідь моделі → draftIntake (запобіжник, промпт, схема, правила застосунку) →
// точний збіг з очікуваним PM. Перевіряє КОД навколо моделі, а не якість моделі — її міряє живий `npm run eval`.
// Записи в recorded.json до живого прогону — заглушки, написані руками (modelId «placeholder …»); `RECORD=1 npm run eval`
// замінює їх справжніми відповідями моделі. Кейси, де запобіжник hasAssistantInstructions відмовляє до моделі (GC-10),
// запису не мають: модель не викликається.

type Recording = { modelId: string; recordedAt: string; promptVersion?: string; text: string };
type Case = GoldenCase & { id: string; ac: string; today: string; input: string };

const cases = casesJson as unknown as Case[];
const recorded = recordedJson as Record<string, Recording>;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** Модель, що «відповідає» записаним текстом. */
function replay(record: Pick<Recording, "text" | "modelId">) {
  return new MockLanguageModelV4({
    modelId: record.modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text: record.text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

/**
 * Відповідь draftIntake у формі, яку порівнює scoreFields: чернетка — як є; відмова — `status: "refused"` з
 * повідомленням (поля порожні). Недоступність чи заборона в golden cases — завжди провал кейсу.
 */
export function goldenActual(response: IntakeDraftResponse): IntakeDraft {
  if (response.kind === "draft") return response.draft;
  if (response.kind !== "refused") throw new Error(`очікували чернетку або відмову, а не ${response.kind}: ${response.message}`);
  return {
    status: "refused",
    clientType: null,
    name: null,
    dateOfBirth: null,
    sessionLanguage: null,
    email: null,
    guardianName: null,
    guardianEmail: null,
    message: response.message,
  };
}

/** Кейс, що доходить до моделі: запис поточної версії промпту → draftIntake → очікуване PM. */
async function expectReplayMatches(c: Case) {
  expect(hasAssistantInstructions(c.input), `${c.id}: запобіжник спрацював на звичайному зверненні`).toBe(false);
  const record = recorded[c.id];
  expect(record, `немає запису для ${c.id} у tests/fixtures/golden/recorded.json`).toBeDefined();
  // Змінили промпт (DRAFT_PROMPT_VERSION) — перезапишіть записи живим прогоном: RECORD=1 npm run eval.
  expect(record.promptVersion, `${c.id}: запис іншої версії промпту`).toBe(DRAFT_PROMPT_VERSION);

  const model = replay(record);
  const actual = goldenActual(await draftIntake({ role: "scheduler", text: c.input, model, today: c.today }));

  expect(scoreFields(c.expected, actual).mismatches).toEqual([]);
  expect(actual).toMatchObject(c.expected);
  expect(model.doGenerateCalls).toHaveLength(1);
  // Недовірений вхід дійшов до моделі загорнутим як дані.
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain(JSON.stringify(wrapDocument(c.input)).slice(1, -1));
}

// Відповідь «зламаної» моделі, що виконала б вказівку з тексту (GC-10: підмінити ім'я на QA Override).
const OBEYING_MODEL: Draft = {
  status: "ok",
  writtenByParentForChild: false,
  clientName: "QA Override",
  dateOfBirth: "1989-12-02",
  sessionLanguage: "English",
  clientEmail: "alex.glen@example.test",
  guardianName: null,
  guardianEmail: null,
};

/** Кейс з вказівками помічнику: відмова кодом до моделі, запис не потрібен. */
async function expectRefusedBeforeModel(c: Case) {
  expect(hasAssistantInstructions(c.input), `${c.id}: запобіжник не впізнав вказівку помічнику`).toBe(true);
  const model = replay({ modelId: "obeying", text: JSON.stringify(OBEYING_MODEL) });
  const response = await draftIntake({ role: "scheduler", text: c.input, model, today: c.today });

  expect(response).toEqual({ kind: "refused", message: DRAFT_REFUSED });
  expect(model.doGenerateCalls).toHaveLength(0);
  expect(scoreFields(c.expected, goldenActual(response)).mismatches).toEqual([]);
}

const byAc = (ac: string) => cases.filter((c) => c.ac === ac);

describe("golden cases PM, офлайн-реплей", () => {
  it.each(byAc("AC-INTAKE-01"))("AC-INTAKE-01: golden $id", async (c) => expectReplayMatches(c));
  it.each(byAc("AC-INTAKE-02"))("AC-INTAKE-02: golden $id", async (c) => expectReplayMatches(c));
  it.each(byAc("AC-INTAKE-04"))("AC-INTAKE-04: golden $id", async (c) => expectReplayMatches(c));
  it.each(byAc("AC-INTAKE-05"))("AC-INTAKE-05: golden $id", async (c) => expectReplayMatches(c));
  it.each(byAc("AC-INTAKE-06"))("AC-INTAKE-06: golden $id", async (c) => expectReplayMatches(c));
  it.each(byAc("AC-INTAKE-07"))("AC-INTAKE-07: golden $id", async (c) => expectRefusedBeforeModel(c));
});
