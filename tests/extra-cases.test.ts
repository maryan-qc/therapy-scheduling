import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { DRAFT_PROMPT_VERSION, wrapDocument } from "@/lib/ai/prompts/draft";
import { scoreFields, type GoldenCase } from "@/lib/ai/scorer";
import { DRAFT_REFUSED, hasAssistantInstructions, type IntakeDraft } from "@/lib/clients/intake";
import { draftIntake, type IntakeDraftResponse } from "@/lib/clients/intake-draft";
import casesJson from "./fixtures/extra/cases.json";
import recordedJson from "./fixtures/extra/recorded.json";

// Додаткові листи розробника X-01…X-18 (tests/fixtures/extra/cases.json) — НЕ golden cases PM: різні типи звернень
// (мова листа ≠ мова сеансів, опікуни, межі дат, шум, треті особи, кілька клієнтів, спам, непряма ін'єкція).
// Очікуване виведено лише з правил PM (requirements/36-…, «Припущення» й AC) і власних припущень розробника
// (openspec/changes/archive/2026-11-14-add-intake-draft-assistant/proposal.md), а не з відповідей моделі.
// Записи (tests/fixtures/extra/recorded.json) — з живого прогону, і лише відповіді, що пройшли: реплей ловить регресії
// коду навколо моделі (запобіжник, промпт, схема, правила застосунку). Кожен кейс без позначки має запис; кейс з
// позначкою фікстури refusalStage: "before-model" запобіжник відмовляє до моделі, і запис йому не потрібен. Групи
// вибирає позначка, а не сам запобіжник: інакше кейс, який запобіжник перестав впізнавати, тихо зник би з обох груп.

type Recording = { modelId: string; recordedAt: string; promptVersion?: string; text: string };
/** Етап відмови: "before-model" — запобіжник у коді, до моделі (AC-INTAKE-07). */
type RefusalStage = "before-model";
type ExtraCase = GoldenCase & {
  id: string;
  ac: string;
  type: string;
  today: string;
  input: string;
  rule: string;
  refusalStage?: RefusalStage;
};

const cases = casesJson as unknown as ExtraCase[];
const recorded = recordedJson as Record<string, Recording>;

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** Модель, що «відповідає» записаним текстом. */
function recordedModel({ modelId, text }: Pick<Recording, "modelId" | "text">) {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: USAGE,
      warnings: [],
    }),
  });
}

/** Відповідь draftIntake так, як її порівнює scoreFields; недоступність чи заборона — провал кейсу. */
function scored(response: IntakeDraftResponse): IntakeDraft {
  if (response.kind === "draft") return response.draft;
  if (response.kind !== "refused") throw new Error(`очікували чернетку або відмову, а не ${response.kind}`);
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

const BEFORE_MODEL: RefusalStage = "before-model";
/** AC, для яких нижче є група реплею. */
const REPLAYED_ACS = ["AC-INTAKE-01", "AC-INTAKE-02", "AC-INTAKE-04", "AC-INTAKE-06", "AC-INTAKE-07"];
/** Кейси з позначкою «відмова кодом до моделі». */
const beforeModel = cases.filter((c) => c.refusalStage === BEFORE_MODEL);
/** Кейси AC, що доходять до моделі (без позначки) — реплей запису живого прогону. */
const viaModel = (ac: string) => cases.filter((c) => c.ac === ac && c.refusalStage !== BEFORE_MODEL);

async function expectRecordedAnswerMatches(c: ExtraCase) {
  expect(hasAssistantInstructions(c.input), `${c.id}: запобіжник відмовив листу без позначки before-model`).toBe(false);
  expect(Object.hasOwn(recorded, c.id), `немає запису для ${c.id} у tests/fixtures/extra/recorded.json`).toBe(true);
  const model = recordedModel(recorded[c.id]);
  const actual = scored(await draftIntake({ role: "scheduler", text: c.input, model, today: c.today }));

  expect(scoreFields(c.expected, actual).mismatches, `${c.id}: ${c.rule}`).toEqual([]);
  expect(actual).toMatchObject(c.expected);
  expect(model.doGenerateCalls).toHaveLength(1);
  // Лист дійшов до моделі загорнутим як дані.
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain(JSON.stringify(wrapDocument(c.input)).slice(1, -1));
}

async function expectRefusedBeforeModel(c: ExtraCase) {
  expect(hasAssistantInstructions(c.input), `${c.id}: запобіжник не впізнав вказівку помічнику`).toBe(true);
  const model = recordedModel({ modelId: "must-not-be-called", text: "{}" });
  const response = await draftIntake({ role: "scheduler", text: c.input, model, today: c.today });

  // Запобіжник спрацював на листі, де правила PM чекають чернетку, — це хибна відмова.
  expect(scoreFields(c.expected, scored(response)).mismatches, `${c.id}: ${c.rule}`).toEqual([]);
  expect(response).toEqual({ kind: "refused", message: DRAFT_REFUSED });
  expect(model.doGenerateCalls).toHaveLength(0);
}

/** Записи, яких не має бути: без свого кейсу, заглушки замість відповіді моделі, інша версія промпту. */
function recordProblems() {
  const ids = new Set(cases.map((c) => c.id));
  const entries = Object.entries(recorded);
  const caseIds = (list: ExtraCase[]) => list.map((c) => c.id);
  return {
    withoutCase: entries.filter(([id]) => !ids.has(id)).map(([id]) => id),
    notModelAnswers: entries.filter(([, r]) => !r.modelId?.trim() || /placeholder/i.test(r.modelId)).map(([id]) => id),
    otherPromptVersion: entries.filter(([, r]) => r.promptVersion !== DRAFT_PROMPT_VERSION).map(([id]) => id),
    viaModelWithoutRecord: caseIds(cases.filter((c) => c.refusalStage !== BEFORE_MODEL && !Object.hasOwn(recorded, c.id))),
    acWithoutGroup: caseIds(cases.filter((c) => !REPLAYED_ACS.includes(c.ac))),
    unknownStage: caseIds(cases.filter((c) => c.refusalStage !== undefined && c.refusalStage !== BEFORE_MODEL)),
    beforeModelNotAcIntake07: caseIds(beforeModel.filter((c) => c.ac !== "AC-INTAKE-07")),
  };
}

// Один describe на все: Vitest валить блок describe без жодного тесту, а it.each з порожнім списком (зараз — кейси
// з позначкою before-model) не створює жодного — у блоці завжди лишається перевірка записів.
describe("додаткові листи X-01…X-18, офлайн-реплей записів живого прогону", () => {
  it("AC-INTAKE-07: записи додаткових кейсів — справжні відповіді моделі поточної версії промпту для кожного кейсу без позначки before-model, і в кожного запису є кейс", () => {
    expect(recordProblems()).toEqual({
      withoutCase: [],
      notModelAnswers: [],
      otherPromptVersion: [],
      viaModelWithoutRecord: [],
      acWithoutGroup: [],
      unknownStage: [],
      beforeModelNotAcIntake07: [],
    });
  });

  it.each(viaModel("AC-INTAKE-01"))("AC-INTAKE-01: додатковий кейс $id ($type)", async (c) =>
    expectRecordedAnswerMatches(c),
  );
  it.each(viaModel("AC-INTAKE-02"))("AC-INTAKE-02: додатковий кейс $id ($type)", async (c) =>
    expectRecordedAnswerMatches(c),
  );
  it.each(viaModel("AC-INTAKE-04"))("AC-INTAKE-04: додатковий кейс $id ($type)", async (c) =>
    expectRecordedAnswerMatches(c),
  );
  it.each(viaModel("AC-INTAKE-06"))("AC-INTAKE-06: додатковий кейс $id ($type)", async (c) =>
    expectRecordedAnswerMatches(c),
  );
  it.each(viaModel("AC-INTAKE-07"))("AC-INTAKE-07: додатковий кейс $id ($type)", async (c) =>
    expectRecordedAnswerMatches(c),
  );

  // Позначені before-model: запобіжник у коді відмовляє до моделі, запис їм не потрібен.
  it.each(beforeModel)("AC-INTAKE-07: додатковий кейс $id ($type) — відмова кодом, модель не викликано", async (c) =>
    expectRefusedBeforeModel(c),
  );
});
