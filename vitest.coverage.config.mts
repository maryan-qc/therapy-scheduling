import { defineConfig, mergeConfig } from "vitest/config";
// «.mjs», а не «.mts»: без allowImportingTsExtensions TypeScript (npm run typecheck, next build) не приймає імпорт
// з розширенням .mts, а «./vitest.config.mjs» і TypeScript, і Vite зводять до vitest.config.mts.
import base from "./vitest.config.mjs";

// Покриття для npm run test:coverage (джерело — демо-репо курсу, тег ws8-01-gates). npm test не змінюється.
//
// Підлога покриття — ЛИШЕ для доменних файлів, які її вже тримають (кожен файл окремо, perFile).
// ЗАМІНІТЬ на свої модулі: шлях від src/lib/ без «.ts», напр. "booking/overlap", "roles/permissions".
// У демо тут 9 файлів ("leave/calendar", "users/roles", "auth/password", …). Файл, що поки нижче, видно в Summary —
// додайте його сюди, коли тести його піднімуть (храповик: підлогу не знижуємо). Порожній список — підлоги немає,
// звіт усе одно будується.
// Загальний відсоток (у демо ≈32 %) не поріг: сторінки й server actions доводять тести бази (PGlite) та e2e, а не Vitest.
// Наше (WS8, PR воріт): файли, що вже тримають 90/85/90/90 на першому прогоні. Поки нижче підлоги (видно в Summary):
// clients/card (функції 85,7 %), holds/day-view (гілки 83 %), holds/time і holds/rules (0 %: правило утримання
// живе в SQL, його доводять тести бази й SQL-мутації).
const FLOORED: string[] = [
  "health",
  "clients/insurance", // WS9, зріз 3: статус перевірки страхування
  "clients/search",
  "holds/clients",
  "holds/messages",
  "holds/schedule",
  "holds/status",
  "holds/types",
];
// Фігурні дужки glob розкриваються лише з комою всередині, тож один файл пишемо без них.
const FLOORED_GLOB = FLOORED.length === 1 ? `src/lib/${FLOORED[0]}.ts` : `src/lib/{${FLOORED.join(",")}}.ts`;

export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        provider: "v8",
        // Без include звіт показав би лише імпортовані тестами файли — сторінки з 0 % зникли б.
        include: ["src/**/*.{ts,tsx}"],
        // Згенеровані типи й компоненти дизайн-системи (якщо є shadcn/ui) — не ваш код під тестами.
        exclude: ["src/lib/supabase/database.types.ts", "src/components/ui/**"],
        // html — для людей (coverage/index.html), json-summary — для npm run coverage:summary, json — для інших інструментів.
        reporter: ["text", "html", "json-summary", "json"],
        reportOnFailure: true,
        thresholds: FLOORED.length
          ? {
              [FLOORED_GLOB]: { statements: 90, branches: 85, functions: 90, lines: 90, perFile: true },
            }
          : {},
      },
    },
  }),
);
