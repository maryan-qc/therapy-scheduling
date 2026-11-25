// Перевірка трекера помилок (WS11 B): навмисна помилка сервера → onRequestError (src/instrumentation.ts) → Telegram.
// Закрито двічі. Середовище — явний дозвіл: лише preview (VERCEL_ENV=preview, зокрема гілка staging) чи APP_ENV=staging;
// прод (VERCEL_ENV=production) і будь-що інше, зокрема локальний запуск без VERCEL_ENV, — 404 ще до входу (рев'ю
// CodeRabbit до #66). Роль — лише адміністратор. Захист Vercel у проєкті вимкнено (preview відкриті), тож без ролі це була б публічна
// кнопка «зламати сервер». Proxy не пускає сюди без сесії (шляху немає в PUBLIC_PATHS) — переспрямовує на /login.
// Текст помилки фіксований і без даних користувача; у Telegram він однаково не йде (лише назва, digest і стек).
import { requireViewer } from "@/lib/supabase/viewer";

export const dynamic = "force-dynamic";

// Route handler може експортувати лише методи HTTP і налаштування маршруту, тож текст помилки — локальна константа.
const MESSAGE = "ops error-check: intentional server error";

export async function GET(): Promise<Response> {
  const production = process.env.VERCEL_ENV === "production";
  const allowed = process.env.VERCEL_ENV === "preview" || process.env.APP_ENV === "staging";
  if (production || !allowed) return new Response(null, { status: 404 });
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return new Response(null, { status: 404 });
  throw new Error(MESSAGE);
}
