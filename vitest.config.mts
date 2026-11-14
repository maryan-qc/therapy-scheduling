import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vite 8: аліас @/* з tsconfig.json без окремого плагіна.
    tsconfigPaths: true,
    // Маркер server-only (src/lib/ai/openrouter.ts) у тестах — як на сервері Next.js: умова react-server дає
    // порожній empty.js пакета; без неї index.js кидає помилку для будь-якого тесту, що імпортує Server Actions.
    alias: { "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Тест без жодної перевірки (порожній it("AC-…", () => {})) падає: ac:coverage рахує тест, тож він має щось перевіряти.
    // Рахуються лише expect(…); assert із vitest чи node:assert — ні (такий тест теж падає).
    expect: { requireAssertions: true },
    // Лише *.test.ts(x): ac:coverage рахує тести з цих файлів і з tests/e2e/**/*.spec.ts (їх запускає Playwright, job e2e).
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // tests/fixtures — дані для тестів скриптів; файли *.test.ts там НЕ запускаються.
    // tests/e2e — територія Playwright: випадковий tests/e2e/*.test.ts упав би тут на імпортах @playwright/test.
    exclude: ["node_modules/**", "tests/fixtures/**", "tests/e2e/**"],
  },
});
