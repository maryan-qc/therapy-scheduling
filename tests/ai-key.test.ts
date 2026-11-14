import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// «Перевірка ключа» (набір курсу materials/ai-feature, ADR 0002): ключ OpenRouter живе лише на сервері, а без ключа
// помічника «не налаштовано» — стан AC-INTAKE-08, форма працює вручну. Статична перевірка файлів репозиторію — без
// мережі й без значення ключа (тест його не читає й не друкує).
const root = process.cwd();
const KEY_READER = "src/lib/ai/openrouter.ts"; // єдиний файл у src/, якому дозволено читати OPENROUTER_API_KEY

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const srcFiles = walk(path.join(root, "src")).map((abs) => ({
  rel: path.relative(root, abs).replaceAll("\\", "/"),
  text: readFileSync(abs, "utf8"),
}));

describe("перевірка ключа: OPENROUTER_API_KEY лише на сервері", () => {
  it("AC-INTAKE-08: обгортку з ключем не імпортувати поза серверним кодом (server-only)", async () => {
    // Тому draftIntake і proposeDraft отримують модель параметром, а не імпортують src/lib/ai/openrouter.ts.
    await expect(import("@/lib/ai/openrouter")).rejects.toThrow(/Server Component/);
  });

  it("AC-INTAKE-08: жодного NEXT_PUBLIC_ для ключа моделі — ні в src/, ні в .env.example", () => {
    const envExample = existsSync(path.join(root, ".env.example"))
      ? readFileSync(path.join(root, ".env.example"), "utf8")
      : "";
    expect(envExample).toMatch(/^OPENROUTER_API_KEY=$/m); // назва змінної є, значення — ні
    const offenders = [...srcFiles, { rel: ".env.example", text: envExample }]
      .filter((file) => /NEXT_PUBLIC_[A-Z0-9_]*(OPENROUTER|LLM|AI_|MODEL|API_KEY)/.test(file.text))
      .map((file) => file.rel);
    expect(offenders).toEqual([]);
  });

  it('AC-INTAKE-08: ключ читає лише src/lib/ai/openrouter.ts, і цей файл починається з import "server-only"', () => {
    const readers = srcFiles.filter((file) => /OPENROUTER_API_KEY/.test(file.text)).map((file) => file.rel);
    expect(readers).toEqual([KEY_READER]);
    const reader = srcFiles.find((file) => file.rel === KEY_READER);
    expect(reader?.text.trimStart().startsWith('import "server-only"')).toBe(true);
  });

  it('AC-INTAKE-08: жоден файл із "use client" не імпортує модель чи обгортку з ключем', () => {
    const clientFiles = srcFiles.filter((file) => /^\s*["']use client["']/.test(file.text));
    const offenders = clientFiles
      .filter((file) => /["']@\/lib\/ai\/(openrouter|models)["']/.test(file.text))
      .map((file) => file.rel);
    expect(offenders).toEqual([]);
  });
});

describe("помічника не налаштовано — productModel() без ключа", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("server-only");
    vi.resetModules();
  });

  /** productModel() з src/lib/ai/openrouter.ts при заданому значенні ключа (поза Next server-only знімаємо підміною). */
  async function productModelWith(key: string | undefined) {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.stubEnv("OPENROUTER_API_KEY", key);
    const { productModel } = await import("@/lib/ai/openrouter");
    return productModel();
  }

  it("AC-INTAKE-08: ключа немає, він порожній чи з самих пробілів — моделі немає (null), а не запит без ключа", async () => {
    expect(await productModelWith(undefined)).toBeNull();
    expect(await productModelWith("")).toBeNull();
    expect(await productModelWith("   \n")).toBeNull();
  });

  it("AC-INTAKE-08: з ключем модель є (без мережі: модель лише створено)", async () => {
    expect(await productModelWith("sk-or-v1-test-not-a-real-key")).not.toBeNull();
  });
});
