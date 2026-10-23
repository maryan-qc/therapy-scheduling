import Link from "next/link";
import { ActionAlerts } from "@/app/_components/action-alerts";
import { Nav } from "@/app/_components/nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CARD_COLUMNS,
  CLIENT_NOT_FOUND,
  clientTypeLabel,
  NO_ACCESS_TO_CLIENT,
  NOT_PROVIDED,
  type ClientCardRow,
} from "@/lib/clients/card";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";

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
// виглядають однаково — «You don't have access to this client.» без жодних даних (AC-CARD-05, AC-CARD-08, Q7);
// планувальнику й адміністратору неіснуюча — «Client not found.» (Q7). Запису тут немає: картка не змінюється.
export default async function ClientCardPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const staff = isStaff(viewer.role);
  const { data } = UUID.test(id)
    ? await viewer.supabase.from("clients").select(CARD_COLUMNS).eq("id", id).maybeSingle()
    : { data: null };
  const client: ClientCardRow | null = data;

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/clients" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <Link href="/clients" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
          ← {staff ? "Clients" : "My clients"}
        </Link>
        {client ? (
          <>
            <ActionAlerts ok={query.ok === "created" ? "Client created." : undefined} />
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
              </CardContent>
            </Card>
          </>
        ) : (
          <ActionAlerts error={staff ? CLIENT_NOT_FOUND : NO_ACCESS_TO_CLIENT} />
        )}
      </main>
    </>
  );
}
