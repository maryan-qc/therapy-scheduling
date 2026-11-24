// Трекер помилок сервера без Sentry (WS11 B): Next.js викликає onRequestError на кожну необроблену помилку сервера
// (сторінка, маршрут API, Server Action, proxy), а ми надсилаємо КОРОТКЕ повідомлення в той самий Telegram-чат, що й
// алерт smoke. Текст складає src/lib/error-alert.ts (без заголовків, тіла, ?query і error.message — див. там і тест).
// Змінні (лише назви): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — у Vercel → Settings → Environment Variables (Production і
// Preview), без префікса NEXT_PUBLIC_. Немає змінних — функція мовчки нічого не робить, продукт від цього не падає.
// Повний стек — у Runtime Logs Vercel за digest чи часом і маршрутом; на Hobby вони живуть 1 годину.
// Перевірка: /api/ops/error-check на preview чи staging (лише адміністратор; на проді — 404).
// Взято з https://github.com/koldovsky/2026-quitcode-11-devops-operations-hw/blob/main/materials/ops-kit/src/instrumentation.ts.example
import type { Instrumentation } from "next";
import { envLabel, errorDigest, errorName, formatErrorAlert, shouldSend } from "@/lib/error-alert";

const TIMEOUT_MS = 2_500; // не тримаємо відповідь користувачу довше: Telegram недоступний — повідомлення пропадає
const lastSent = new Map<string, number>();

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // routePath — шаблон маршруту (/clients/[id]), без id і без ?query. request.path і request.headers не беремо.
  const key = `${context.routePath}|${errorDigest(error) || errorName(error)}`;
  if (!shouldSend(lastSent, key, Date.now())) return;

  const text = formatErrorAlert({
    error,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    env: envLabel(process.env.APP_ENV, process.env.VERCEL_ENV),
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    sha: process.env.VERCEL_GIT_COMMIT_SHA,
  });

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Навмисно нічого не пишемо: помилка fetch містить адресу запиту, а в ній — токен бота.
  }
};
