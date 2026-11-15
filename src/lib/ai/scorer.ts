import type { IntakeDraft } from "@/lib/clients/intake";

// Один golden case PM: вхід → очікуване. Формат файлу — tests/fixtures/golden/cases.json
// (вхід і «Правило» дослівно з таблиці PM #36, expected — лише значення з колонки «Очікуваний результат»).
export type GoldenCase = {
  id: string; // "GC-01"
  ac: string; // AC, на який посилається PM у «Правилі»
  today: string; // «сьогодні» кейса, РРРР-ММ-ДД (America/Los_Angeles)
  timezone: string;
  input: string;
  expected: Partial<IntakeDraft>;
  rule: string;
};

// Точний збіг полів, зафіксованих PM. LLM-суддя не потрібен: у чернетці немає вільного тексту (ADR 0002).
export function scoreFields(expected: GoldenCase["expected"], actual: Partial<IntakeDraft>) {
  const mismatches = (Object.keys(expected) as (keyof IntakeDraft)[])
    .filter((key) => expected[key] !== actual[key])
    .map((key) => ({ field: key, expected: expected[key], actual: actual[key] }));
  return { pass: mismatches.length === 0, mismatches };
}

// Частка успіху (pass rate) — визначення з WS8: прогін на задачах із відомими відповідями → бал.
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((result) => result.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}
