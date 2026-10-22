import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { signOut } from "./login/actions";

// Головна: перенаправлення за роллю — планувальник і адміністратор на слоти, терапевт на свій розклад.
// Без ролі (профіль не знайдено) — хто увійшов і кнопка виходу.
export default async function Home() {
  const viewer = await requireViewer();
  if (isStaff(viewer.role)) redirect("/slots");
  if (viewer.role === "therapist") redirect("/schedule");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Therapy scheduling</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd data-testid="user-email">{viewer.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd data-testid="user-role">profile not found</dd>
      </dl>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
