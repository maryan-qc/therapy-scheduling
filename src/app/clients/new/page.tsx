import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { CARD_MESSAGES, cardRoleError } from "@/lib/clients/card";
import { practiceDate } from "@/lib/holds/time";
import { requireViewer } from "@/lib/supabase/viewer";
import { ClientCardForm } from "./card-form";

// Нова картка клієнта з анкети — лише планувальник і адміністратор; терапевт бачить відмову без форми (AC-CARD-06).
// Ту саму перевірку робить і дія createClientCard: сторінка — лише зручність.
export default async function NewClientCardPage() {
  const viewer = await requireViewer();
  const forbidden = cardRoleError(viewer.role);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/clients" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">New client card</h1>
        {forbidden ? (
          <ActionAlerts error={CARD_MESSAGES[forbidden]} />
        ) : (
          <ClientCardForm today={practiceDate(new Date())} />
        )}
      </main>
    </>
  );
}
