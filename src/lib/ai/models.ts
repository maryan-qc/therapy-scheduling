import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Ланцюжок безкоштовних моделей OpenRouter (ADR 0002). Перевірено `npm run ai:models` 2026-11-14: усі три є.
// Порядок = пріоритет. Лише ID із `:free`: платна модель у списку fallback оплачується за її ціною.
//   nemotron-3.5-super-vl — строга JSON-схема (structured_outputs); демо курсу 09.11 — 10/10 саме на ній;
//   gemma-4-31b / 26b     — без structured_outputs: схему може бути проігноровано, тому поля повторено в промпті,
//                           а ворота — zod.
export const PRODUCT_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
] as const;

// Фабрика приймає ключ параметром і НЕ читає process.env: так її можна імпортувати в живому eval.
// У коді застосунку модель бере лише src/lib/ai/openrouter.ts (server-only).
export function makeProductModel(apiKey: string) {
  const openrouter = createOpenRouter({ apiKey, appName: "therapy-scheduling intake draft" });
  return openrouter.chat(PRODUCT_MODELS[0], {
    // OpenRouter пробує наступну модель при помилці, ліміті постачальника або простої.
    // Ліміт безкоштовних моделей акаунта (20/хв, 50/добу) ланцюжок НЕ обходить.
    models: [...PRODUCT_MODELS],
    reasoning: { effort: "low", exclude: true },
  });
}
