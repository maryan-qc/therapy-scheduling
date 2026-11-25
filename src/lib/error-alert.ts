// Текст повідомлення про помилку сервера для Telegram (WS11 B, трекер помилок без Sentry). Чисті функції без мережі
// й без process.env — їх кличе src/instrumentation.ts (onRequestError) і перевіряє tests/error-alert.test.ts.
// Що НЕ потрапляє в повідомлення ніколи: заголовки запиту (там cookie сесії), тіло, рядок запиту (?query) і
// error.message (може містити дані користувача). Функції навіть не отримують request.headers — лише метод.
// Зі стеку беремо лише рядки «at …» (функція, файл, рядок коду), абсолютні шляхи скорочуємо до .next/…, src/…,
// node_modules/… (без імені користувача ОС).
// Логіка — з https://github.com/koldovsky/2026-quitcode-11-devops-operations-hw/blob/main/materials/ops-kit/src/instrumentation.ts.example
// Наше: винесено з instrumentation.ts у чисті функції з тестами; середовище — коротке значення без пробілів.

export const STACK_FRAMES = 5; // скільки верхніх рядків «at …» стеку надсилати
export const FRAME_MAX = 160; // найдовший рядок стеку
export const SAME_ERROR_PAUSE_MS = 60_000; // та сама помилка на тому самому маршруті — не частіше разу на хвилину

/**
 * Лише рядки «at …» зі стеку. Заголовок «Назва: текст помилки» відрізаємо цілим (текст може бути багаторядковим і
 * містити дані користувача), беремо лише рядки виду «at … файл:рядок:колонка».
 * Заголовок шукаємо в двох формах: з поточною назвою і з «Error» (клас помилки, що ставить this.name після super(),
 * лишає в стеку «Error: …»). Не збігся жоден — кадрів не надсилаємо: текст повідомлення могли змінити після запису
 * стеку, і рядок тексту, схожий на «at …», пройшов би фільтр (рев'ю CodeRabbit до #66).
 */
export function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  const stack = error.stack;
  const headers = [error.name, "Error"].map((name) => (error.message ? `${name}: ${error.message}` : name));
  const header = headers.find((candidate) => stack.startsWith(candidate));
  if (header === undefined) return [];
  return stack
    .slice(header.length)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at ") && /:\d+:\d+\)?$/.test(line))
    .map(shortenPaths)
    .slice(0, STACK_FRAMES)
    .map((line) => line.slice(0, FRAME_MAX));
}

/**
 * Абсолютні шляхи без імені користувача ОС: до відомої теки збірки — «.next/…», «src/…», «node_modules/…»;
 * будь-який інший абсолютний шлях (зокрема file://) — лише ім'я файлу з рядком і колонкою.
 */
function shortenPaths(line: string): string {
  // (?<=^|[\s(]) — шлях починається з початку рядка, після пробілу чи «(»: уже скорочений «src/…» не чіпаємо.
  return line
    .replace(/(?<=^|[\s(])(?:file:\/\/)?(?:[A-Za-z]:)?[\\/][^\s()]*?[\\/](\.next|src|node_modules)[\\/]/g, "$1/")
    .replace(/(?<=^|[\s(])(?:file:\/\/)?(?:[A-Za-z]:)?[\\/][^\s()]*[\\/]([^\\/\s()]+:\d+:\d+)/g, "$1");
}

/** Назва помилки (не текст): Error, TypeError… Для не-Error — лише тип значення. */
export function errorName(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  return /^[A-Za-z0-9_$.]{1,60}$/.test(error.name) ? error.name : "Error";
}

/** digest Next.js — хеш, за яким помилку знаходять у Runtime Logs. Лише короткий токен. */
export function errorDigest(error: unknown): string {
  const raw = (error as { digest?: unknown } | null)?.digest;
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : "";
}

/** Назва середовища для повідомлення: APP_ENV (staging) → VERCEL_ENV → local; лише короткий токен. */
export function envLabel(appEnv: string | undefined, vercelEnv: string | undefined): string {
  const value = (appEnv?.trim() || vercelEnv?.trim() || "local").slice(0, 32);
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : "invalid";
}

export type AlertInput = {
  error: unknown;
  method: string;
  /** Шаблон маршруту (/clients/[id]), не адреса з id і ?query. */
  routePath: string;
  routeType: string;
  routerKind: string;
  env: string;
  branch?: string;
  deploymentId?: string;
  sha?: string;
};

/** Текст повідомлення в Telegram: маршрут, метод, назва помилки, digest, середовище, деплой, до 5 рядків стеку. */
export function formatErrorAlert(input: AlertInput): string {
  const name = errorName(input.error);
  const digest = errorDigest(input.error);
  const frames = stackFrames(input.error);
  const method = /^[A-Z]{3,7}$/.test(input.method) ? input.method : "?";
  return [
    "ПОМИЛКА СЕРВЕРА",
    `Середовище: ${input.env}${input.branch ? ` (гілка ${input.branch.slice(0, 60)})` : ""}`,
    `Маршрут: ${method} ${input.routePath.split(/[?#]/)[0].slice(0, 120)} (${input.routeType}, ${input.routerKind})`,
    `Помилка: ${name}${digest ? `, digest ${digest}` : ""}`,
    `Деплой: ${input.deploymentId ?? "?"}, коміт ${(input.sha ?? "local").slice(0, 7)}`,
    ...(frames.length ? ["Стек (верхні рядки):", ...frames] : []),
  ].join("\n");
}

/** Пауза для однакових помилок: true — надсилати (і запам'ятати час), false — ще не минула хвилина. */
export function shouldSend(lastSent: Map<string, number>, key: string, now: number): boolean {
  if (now - (lastSent.get(key) ?? Number.NEGATIVE_INFINITY) < SAME_ERROR_PAUSE_MS) return false;
  lastSent.set(key, now);
  return true;
}
