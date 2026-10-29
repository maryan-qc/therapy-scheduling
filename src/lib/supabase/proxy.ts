// Оновлення сесії Supabase на кожен запит (викликається з src/proxy.ts).
// Офіційний патерн @supabase/ssr ≥ 0.10: setAll(cookies, headers) — заголовки
// Cache-Control/Expires/Pragma копіюємо у відповідь, щоб CDN не кешував auth-відповіді.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Сторінки, доступні без входу; /api/health — публічна перевірка проду (D0 WS8), без даних користувачів.
const PUBLIC_PATHS = ["/login", "/auth", "/api/health"];
// Шляхи без сесії: перевірка проду не читає cookie, тож proxy не створює для неї клієнт Supabase і не викликає
// getClaims() — /api/health відповідає своїм JSON навіть тоді, коли з Supabase щось не так.
const SESSIONLESS_PATHS = ["/api/health"];

// Сам шлях або його підшлях: «/api/healthz» чи «/loginx» — ні.
const matchesAny = (paths: string[], pathname: string) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export const isPublicPath = (pathname: string) => matchesAny(PUBLIC_PATHS, pathname);
export const isSessionlessPath = (pathname: string) => matchesAny(SESSIONLESS_PATHS, pathname);

export async function updateSession(request: NextRequest) {
  if (isSessionlessPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Між createServerClient і getClaims() не додавайте жодного коду:
  // інакше користувачів може випадково «розлогінювати».
  // getClaims() перевіряє підпис JWT; getSession() для авторизації НЕ використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const isPublic = isPublicPath(request.nextUrl.pathname);

  if (!claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Повертаємо саме supabaseResponse: у ньому оновлені cookie сесії.
  return supabaseResponse;
}
