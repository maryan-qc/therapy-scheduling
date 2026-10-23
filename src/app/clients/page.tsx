import Link from "next/link";
import { Nav } from "@/app/_components/nav";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CARD_COLUMNS, clientTypeLabel, NO_CLIENTS_YET, NOT_PROVIDED, type ClientCardRow } from "@/lib/clients/card";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";

function Value({ children }: { children: string | null }) {
  return children ? <>{children}</> : <span className="text-muted-foreground">{NOT_PROVIDED}</span>;
}

// Картки клієнтів: планувальник і адміністратор бачать усі (AC-CARD-10), терапевт — лише своїх клієнтів з усіма даними
// анкети (AC-CARD-04, AC-CARD-08) або порожній стан (AC-CARD-09). Рядки фільтрує RLS (clients_select), не сторінка.
export default async function ClientsPage() {
  const viewer = await requireViewer();
  const staff = isStaff(viewer.role);
  const { data } = await viewer.supabase.from("clients").select(CARD_COLUMNS).order("name");
  const clients: ClientCardRow[] = data ?? [];

  return (
    <>
      <Nav email={viewer.email} role={viewer.role} current="/clients" />
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">{staff ? "Clients" : "My clients"}</h1>
          {staff ? (
            <Link href="/clients/new" className={buttonVariants()}>
              New client card
            </Link>
          ) : null}
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="clients-empty">
            {staff ? "No client cards yet." : NO_CLIENTS_YET}
          </p>
        ) : (
          <Card className="gap-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead>Session language</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Guardian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} data-testid="client-row">
                    <TableCell>
                      <Link href={`/clients/${client.id}`} className="font-medium underline-offset-3 hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{clientTypeLabel(client.client_type)}</TableCell>
                    <TableCell className="tabular-nums">
                      <Value>{client.date_of_birth}</Value>
                    </TableCell>
                    <TableCell>
                      <Value>{client.session_language}</Value>
                    </TableCell>
                    <TableCell>
                      {client.client_type === "child" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Value>{client.email}</Value>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.client_type === "child" ? (
                        `${client.guardian_name} (${client.guardian_email})`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </>
  );
}
