import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { signConsentDocument } from "@/app/clients/actions";
import { buttonVariants } from "@/components/ui/button";
import { NO_ACCESS_TO_CLIENT } from "@/lib/clients/card";
import { CONSENT_COLUMNS, CONSENT_MESSAGES, documentText, type ConsentDocumentRow } from "@/lib/clients/consent";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { DocumentCard } from "./document-card";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_MESSAGES: Record<string, string> = Object.fromEntries(
  Object.entries(CONSENT_MESSAGES).map(([code, text]) => [`consent.${code}`, text]),
);

/** Документ і картка його клієнта — обидва фільтрує RLS: чужого клієнта терапевт не отримує (AC-DOC-10). */
async function loadDocument(viewer: Awaited<ReturnType<typeof requireViewer>>, clientId: string, documentId: string) {
  if (!UUID.test(clientId) || !UUID.test(documentId)) return null;
  const [docResult, clientResult] = await Promise.all([
    viewer.supabase
      .from("consent_documents")
      .select(CONSENT_COLUMNS)
      .eq("id", documentId)
      .eq("client_id", clientId)
      .maybeSingle(),
    viewer.supabase.from("clients").select("name, client_type, guardian_name").eq("id", clientId).maybeSingle(),
  ]);
  if (docResult.error) throw docResult.error;
  if (clientResult.error) throw clientResult.error;
  const document: ConsentDocumentRow | null = docResult.data;
  const client = clientResult.data;
  return document && client ? { document, client, text: documentText(document, client) } : null;
}

// Сторінка документа згоди (AC-DOC-04, 05, 09, 10). Немає документа чи доступу: персоналу — «This consent document
// doesn't exist.», терапевту — «You don't have access to this client.» без тексту (AC-DOC-10). Без входу — сторінка
// входу (proxy, AC-DOC-11). Запису тут немає.
export default async function ConsentDocumentPage({
  params,
  searchParams,
}: PageProps<"/clients/[id]/documents/[documentId]">) {
  const [{ id, documentId }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const staff = isStaff(viewer.role);
  const found = await loadDocument(viewer, id, documentId);

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/clients" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <Link
          href={found ? `/clients/${id}` : "/clients"}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}
        >
          <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
          {found?.client.name ?? (staff ? "Clients" : "My clients")}
        </Link>
        {found ? (
          <>
            <ActionAlerts error={ERROR_MESSAGES[String(query.error)]} />
            <DocumentCard
              clientId={id}
              document={found.document}
              text={found.text}
              canSign={staff}
              sign={signConsentDocument}
            />
          </>
        ) : (
          <ActionAlerts error={staff ? CONSENT_MESSAGES.NOT_FOUND : NO_ACCESS_TO_CLIENT} />
        )}
      </main>
    </>
  );
}
