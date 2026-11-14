import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { proposeDraft } from "@/lib/ai/draft";
import { PRODUCT_MODELS, makeProductModel } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { DraftSchema } from "@/lib/ai/schema";
import { passRate, scoreFields, type GoldenCase } from "@/lib/ai/scorer";
import { DRAFT_REFUSED, finalizeDraft, hasAssistantInstructions } from "@/lib/clients/intake";
import casesJson from "../tests/fixtures/golden/cases.json";

// `npm run eval` — ЖИВИЙ прогін golden cases PM (#36) на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в
// CI. Потрібен власний ключ у .env.local (OPENROUTER_API_KEY); без ключа всі кейси пропускаються — це не помилка.
// Шлях той самий, що в застосунку: запобіжник ін'єкції в коді → модель → правила PM у коді (finalizeDraft).
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною, у частку успіху не входять. Тайм-аут, помилка
// постачальника, відповідь не за схемою — FAIL з причиною. Взято з набору курсу
// koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature (evals/golden.live.eval.ts), без LLM-судді.
//   RUNS=2    — кілька прогонів поспіль для частки успіху.
//   RECORD=1  — успішні відповіді моделі дописати в tests/fixtures/golden/recorded.json (офлайн-реплей у CI).

const cases = casesJson as GoldenCase[];
const key = process.env.OPENROUTER_API_KEY?.trim();
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — по запиту на кожен кейс. Кейс, який відхиляє запобіжник коду, теж ставимо моделі — лише щоб
// чесно показати у звіті, чи відмовила б вона сама (на результат кейса це не впливає).
const NEEDED = RUNS * cases.length;
const GAP_MS = 3_000; // ≤ 20 запитів/хв

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
type Row = {
  run: number;
  id: string;
  ac: string;
  modelId: string;
  layer: "модель" | "запобіжник коду";
  modelStatus: string;
  pass: boolean;
  notRun?: boolean;
  why?: string;
};
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

describe.skipIf(!key)("golden cases PM, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id} (${c.ac})`, async (ctx) => {
        const base = { run, id: c.id, ac: c.ac };
        if (stoppedAt) {
          rows.push({ ...base, modelId: "—", layer: "модель", modelStatus: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        const guard = hasAssistantInstructions(c.input);
        // maxRetries 0: денний 429 повтором не виправити, повтор лише з'їдає ліміт.
        const result = await proposeDraft({ text: c.input }, makeProductModel(key!), { maxRetries: 0, timeoutMs: 90_000 });
        if (!result.ok && result.reason === "rate_limited") {
          stoppedAt = `${c.id}, прогін ${run}`;
          rows.push({ ...base, modelId: "—", layer: "модель", modelStatus: "—", pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
          return ctx.skip();
        }

        if (guard) {
          // У застосунку модель тут не викликається: відмову дає код (AC-INTAKE-07). Відповідь моделі — лише для звіту.
          const actual = { status: "refused" as const, message: DRAFT_REFUSED };
          const fields = scoreFields(c.expected, actual);
          rows.push({
            ...base,
            modelId: result.ok ? result.modelId : "—",
            layer: "запобіжник коду",
            modelStatus: result.ok ? `модель сама: ${result.draft.status}` : `модель: ${result.reason}`,
            pass: fields.pass,
            why: fields.pass ? undefined : JSON.stringify(fields.mismatches),
          });
          expect(fields.mismatches).toEqual([]);
          return;
        }

        if (!result.ok) {
          // Рядок у звіт — ДО перевірки, щоб кейс не зник зі знаменника.
          rows.push({ ...base, modelId: "—", layer: "модель", modelStatus: result.reason, pass: false, why: `${result.reason}: ${result.message}` });
        }
        expect(result.ok, result.ok ? "" : `${result.reason}: ${result.message}`).toBe(true);
        if (!result.ok) return;

        const draft = finalizeDraft(result.draft, c.today);
        const fields = scoreFields(c.expected, draft);
        rows.push({
          ...base,
          modelId: result.modelId,
          layer: "модель",
          modelStatus: result.draft.status,
          pass: fields.pass,
          why: fields.pass ? undefined : fields.mismatches.map((m) => `${m.field}: очікувано ${JSON.stringify(m.expected)}, є ${JSON.stringify(m.actual)}`).join("; "),
        });
        // Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
        if (RECORD && fields.pass) {
          fresh[c.id] = {
            modelId: result.modelId,
            recordedAt: new Date().toISOString(),
            promptVersion: DRAFT_PROMPT_VERSION,
            text: JSON.stringify(DraftSchema.parse(result.draft)),
          };
        }
        expect(fields.mismatches).toEqual([]);
      });
    }
  }

  afterAll(() => {
    console.table(rows); // яка модель з ланцюжка відповіла на кожен кейс: бал — за модель, а не «за AI»
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
      const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
  });
});

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) {
    const label = r.layer === "запобіжник коду" ? "запобіжник коду (модель не викликається)" : r.modelId;
    byModel.set(label, [...(byModel.get(label) ?? []), r]);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін golden cases PM (#36) — ${new Date().toISOString()}`,
    "",
    `- Промпт: \`${DRAFT_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}; LLM-судді немає (усе очікуване — точні поля)`,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}; «сьогодні» кейсів: ${cases[0]?.today} (America/Los_Angeles)`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь; поріг PM — ≥ 8/10, GC-09 і GC-10 обов'язкові`,
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Хто дав відповідь | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | AC | Модель | Хто вирішив | Статус моделі | Результат | Розбіжності / помилка |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.run} | ${r.id} | ${r.ac} | \`${r.modelId}\` | ${r.layer} | ${r.modelStatus} | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`,
    ),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}
