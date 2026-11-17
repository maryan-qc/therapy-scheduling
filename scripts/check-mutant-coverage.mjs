#!/usr/bin/env node
// npm run mutation:coverage — кожна міграція з правилами доступу має хоча б одного SQL-мутанта (scripts/mutants.mjs)
// або стоїть у NO_MUTANT з причиною. Інакше «13 з 13 вбито» мовчить про нове правило, якого жоден мутант не торкається
// (рев'ю викладача WS9, п. 1). Без мережі й без бази — лише читання файлів, тож job quality запускає його на кожному PR.
// Код виходу: 0 — усе покрито; 1 — є міграція з правилами без мутанта (назва файлу й правила в stderr).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mutants } from "./mutants.mjs";

const DIR = "supabase/migrations";
// Правило доступу: політика RLS, видача прав або функція з правами власника. «grant» — окремим словом будь-де:
// після «;» іншої інструкції, в «alter default privileges … grant …» і в динамічному execute 'grant …'. Слово в
// коментарі теж рахується — це лише суворіше (така міграція вимагатиме мутанта або причину в NO_MUTANT).
const RULE = /\b(create|alter)\s+policy\b|\bgrant\s|\bsecurity\s+definer\b/gim;

/** Правила доступу в тексті міграції (нормалізовані: «create policy», «grant», «security definer»). */
export function accessRules(sql) {
  return (sql.match(RULE) ?? []).map((r) => r.replace(/^[;\s]+/, "").replace(/\s+/g, " ").trim().toLowerCase());
}

/** Міграції без власних правил доступу — з причиною (без причини виняток не приймаємо). */
const NO_MUTANT = {
  "20261021150000_slot_hold_roles.sql": "лише значення enum ролей, правил доступу немає",
  "20261023105252_pm_therapist_seed.sql": "лише сид синтетичних даних PM",
};

function main() {
  const covered = new Set(mutants.filter((m) => m.kind === "sql").map((m) => path.basename(m.file)));
  const problems = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const rules = accessRules(readFileSync(path.join(DIR, file), "utf8"));
    const reason = NO_MUTANT[file];
    if (reason !== undefined && !reason.trim()) problems.push(`${file}: виняток без причини`);
    if (rules.length === 0 || covered.has(file) || reason) continue;
    problems.push(`${file}: правил доступу ${rules.length} (${[...new Set(rules)].join(", ")}), мутанта немає`);
  }
  if (problems.length) {
    console.error("mutation:coverage — міграції з правилами без мутанта:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Додайте мутанта в scripts/mutants.mjs (find/replace, що ламає правило) або причину в NO_MUTANT.");
    process.exit(1);
  }
  console.log(`mutation:coverage — OK: міграцій з правилами покрито мутантами ${covered.size}, винятків ${Object.keys(NO_MUTANT).length}.`);
}

// Запуск як скрипт (npm run mutation:coverage); імпорт у тесті лише бере accessRules.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
