import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { DRAFT_INSTRUCTIONS, wrapDocument } from "./prompts/draft";
import { DraftSchema, type Draft } from "./schema";

// Чиста функція: модель передають параметром. Застосунок передає модель OpenRouter (src/lib/ai/openrouter.ts),
// тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і немає process.env,
// тож Vitest і живий eval імпортують цей файл. Узято з набору курсу
// koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature (src/lib/ai/draft.ts), без вкладень-файлів.

export type DraftResult =
  | { ok: true; draft: Draft; modelId: string }
  | { ok: false; reason: "invalid_output" | "rate_limited" | "timeout" | "provider_error"; message: string };

export type DraftOptions = {
  maxRetries?: number;
  timeoutMs?: number;
};

export async function proposeDraft(input: { text: string }, model: LanguageModel, opts: DraftOptions = {}): Promise<DraftResult> {
  try {
    const result = await generateText({
      model,
      instructions: DRAFT_INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(input.text) }] }],
      output: Output.object({ name: "intake_draft", schema: DraftSchema }),
      temperature: 0,
      // Повтор витрачає той самий денний ліміт безкоштовних моделей: 0–1, не типові 2. Циклу повторів немає.
      maxRetries: opts.maxRetries ?? 1,
      timeout: opts.timeoutMs ?? 30_000,
    });
    // result.output уже перевірено за DraftSchema (інакше — виняток NoObjectGeneratedError).
    return { ok: true, draft: result.output, modelId: result.response.modelId };
  } catch (error) {
    return classifyError(error);
  }
}

export function classifyError(error: unknown): Extract<DraftResult, { ok: false }> {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { ok: false, reason: "invalid_output", message: "model output did not match the schema" };
  }
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    if (code === 429 || code === "429") {
      return { ok: false, reason: "rate_limited", message: "free-model limit reached" };
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { ok: false, reason: "timeout", message: "model did not answer in time" };
  }
  return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}
