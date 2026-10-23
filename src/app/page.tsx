import { CircleAlertIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isStaff, NO_ROLE_MESSAGE } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { signOut } from "./login/actions";

// Головна: перенаправлення за роллю — планувальник і адміністратор на слоти, терапевт на свій розклад.
// Без ролі — лише повідомлення AC-CARD-11 і вихід, жодних даних; сюди ж перенаправляють інші сторінки.
export default async function Home() {
  const viewer = await requireViewer({ allowNoRole: true });
  if (isStaff(viewer.role)) redirect("/slots");
  if (viewer.role === "therapist") redirect("/schedule");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Therapy scheduling</h1>
      <Alert variant="destructive" data-testid="no-role">
        <CircleAlertIcon strokeWidth={1.5} aria-hidden="true" />
        <AlertTitle>{NO_ROLE_MESSAGE}</AlertTitle>
      </Alert>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
