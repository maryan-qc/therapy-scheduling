import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/supabase/viewer";
import { signOut } from "./login/actions";

// Головна: перенаправлення за роллю. Без ролі (профіль не знайдено) — хто увійшов і кнопка виходу.
export default async function Home() {
  const viewer = await requireViewer();
  if (viewer.role) redirect("/slots");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Therapy scheduling</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd data-testid="user-email">{viewer.email ?? "—"}</dd>
        <dt className="text-zinc-500">Role</dt>
        <dd data-testid="user-role">profile not found</dd>
      </dl>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
