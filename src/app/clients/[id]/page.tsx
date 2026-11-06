import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CARD_COLUMNS,
  CARD_NOT_FOUND,
  clientTypeLabel,
  NO_ACCESS_TO_CLIENT,
  NOT_PROVIDED,
  type ClientCardRow,
} from "@/lib/clients/card";
import { CONSENT_COLUMNS, CONSENT_MESSAGES, type ConsentDocumentRow } from "@/lib/clients/consent";
import { INSURANCE_MESSAGES, INSURANCE_SAVED } from "@/lib/clients/insurance";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";
import { prepareConsentDocuments, setInsuranceStatus, signConsentDocument } from "@/app/clients/actions";
import { ConsentSection } from "./consent-section";
import { InsuranceSection } from "./insurance-section";

// Результат дії з адреси (?ok=): тексти — з AC.
const OK_MESSAGES: Record<string, string> = { created: "Client created.", insurance: INSURANCE_SAVED };
// Відмови дій картки (?error=insurance.… / consent.…).
const ERROR_MESSAGES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(INSURANCE_MESSAGES).map(([code, text]) => [`insurance.${code}`, text])),
  ...Object.fromEntries(Object.entries(CONSENT_MESSAGES).map(([code, text]) => [`consent.${code}`, text])),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ?? <span className="text-muted-foreground">{NOT_PROVIDED}</span>}</dd>
    </>
  );
}

// Картка клієнта. Чужу картку терапевту не віддає база (RLS clients_select), тож для нього чужа й неіснуюча картка
// виглядають однаково — «You don't have access to this client.» без жодних даних (AC-CARD-05, 08, 14, 16);
// планувальнику й адміністратору неіснуюча — «This client card doesn't exist.» (AC-CARD-16). Запису тут немає.
export default async function ClientCardPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const staff = isStaff(viewer.role);
  // Некоректний id — картки немає; помилка запиту — сторінка помилки, а не «не знайдено» чи «немає доступу».
  // Картка й документи згоди одне від одного не залежать — паралельно; обидва рядки фільтрує RLS (AC-DOC-09, 10).
  const [{ data, error }, { data: documentRows, error: documentsError }] = UUID.test(id)
    ? await Promise.all([
        viewer.supabase.from("clients").select(CARD_COLUMNS).eq("id", id).maybeSingle(),
        viewer.supabase.from("consent_documents").select(CONSENT_COLUMNS).eq("client_id", id),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
      ];
  if (error) throw error;
  if (documentsError) throw documentsError;
  const client: ClientCardRow | null = data;
  const documents: ConsentDocumentRow[] = documentRows ?? [];

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/clients" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <Link href="/clients" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
          <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
          {staff ? "Clients" : "My clients"}
        </Link>
        {client ? (
          <>
            <ActionAlerts ok={OK_MESSAGES[String(query.ok)]} error={ERROR_MESSAGES[String(query.error)]} />
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>
                  <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm" data-testid="client-card">
                  <Field label="Type" value={clientTypeLabel(client.client_type)} />
                  <Field label="Name" value={client.name} />
                  <Field label="Date of birth" value={client.date_of_birth} />
                  <Field label="Session language" value={client.session_language} />
                  {client.client_type === "child" ? (
                    <>
                      <Field label="Guardian name" value={client.guardian_name} />
                      <Field label="Guardian email" value={client.guardian_email} />
                    </>
                  ) : (
                    <Field label="Email" value={client.email} />
                  )}
                </dl>
                <InsuranceSection
                  clientId={client.id}
                  status={client.insurance_status}
                  canEdit={staff}
                  action={setInsuranceStatus}
                />
                <ConsentSection
                  clientId={client.id}
                  documents={documents}
                  canEdit={staff}
                  prepare={prepareConsentDocuments}
                  sign={signConsentDocument}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <ActionAlerts error={staff ? CARD_NOT_FOUND : NO_ACCESS_TO_CLIENT} />
        )}
      </main>
    </>
  );
}
