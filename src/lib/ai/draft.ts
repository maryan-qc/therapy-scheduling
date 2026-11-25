import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { isFallback, logLlmCall } from "./llm-log";
import { DRAFT_INSTRUCTIONS, DRAFT_PROMPT_VERSION, wrapDocument } from "./prompts/draft";
import { DraftSchema, type Draft } from "./schema";

// Чиста функція: модель передають параметром. Застосунок передає модель OpenRouter (src/lib/ai/openrouter.ts),
// тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і немає process.env,
// тож Vitest і живий eval імпортують цей файл. Узято з набору курсу
// koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature (src/lib/ai/draft.ts), без вкладень-файлів.

export type DraftResult =
  | { ok: true; draft: Draft; modelId: string }
  | { ok: false; reason: "invalid_output" | "rate_limited" | "timeout" | "provider_error"; message: string };

/** WS11: куди писати рядок llm.call (src/lib/ai/llm-log.ts). Немає — журналу немає (golden-тести й живий eval). */
export type LlmLogTarget = { requestId: string; route: string; primaryModel: string };

export type DraftOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  log?: LlmLogTarget;
};

export async function proposeDraft(input: { text: string }, model: LanguageModel, opts: DraftOptions = {}): Promise<DraftResult> {
  const started = performance.now();
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
    if (opts.log) {
      const cost = (result.providerMetadata?.openrouter as { usage?: { cost?: unknown } } | undefined)?.usage?.cost;
      logLlmCall({
        requestId: opts.log.requestId,
        route: opts.log.route,
        model: result.response.modelId,
        fallbackUsed: isFallback(result.response.modelId, opts.log.primaryModel),
        state: result.output.status, // ok | needs_info | refused — відповідь моделі до правил PM
        latencyMs: performance.now() - started,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: typeof cost === "number" ? cost : undefined,
        promptVersion: DRAFT_PROMPT_VERSION,
      });
    }
    return { ok: true, draft: result.output, modelId: result.response.modelId };
  } catch (error) {
    const failure = classifyError(error);
    if (opts.log) {
      logLlmCall({
        requestId: opts.log.requestId,
        route: opts.log.route,
        model: opts.log.primaryModel,
        fallbackUsed: false,
        state: "unavailable",
        latencyMs: performance.now() - started,
        promptVersion: DRAFT_PROMPT_VERSION,
        errorKind: failure.reason, // КОД причини; failure.message (текст постачальника) у журнал не йде
      });
    }
    return failure;
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
