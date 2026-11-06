import { FilePlusIcon, SignatureIcon } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  consentTitle,
  documentState,
  inSetOrder,
  NO_DOCUMENTS,
  signaturesLine,
  type ConsentDocumentRow,
} from "@/lib/clients/consent";

type Action = (formData: FormData) => Promise<void>;

// Документи згоди в картці (AC-DOC-01…06, 09): список у порядку набору зі станом і рядок «Missing signatures» /
// «All consent documents signed.» бачить кожен, хто бачить картку; сформувати й позначити підпис — лише персонал.
// Дії — параметрами, щоб розділ рендерився й без серверного модуля.
export function ConsentSection({
  clientId,
  documents,
  canEdit,
  prepare,
  sign,
}: {
  clientId: string;
  documents: ConsentDocumentRow[];
  canEdit: boolean;
  prepare: Action;
  sign: Action;
}) {
  const ordered = inSetOrder(documents);
  return (
    <section className="mt-4 flex flex-col gap-3 border-t pt-4" aria-labelledby="consent-heading">
      <h2 id="consent-heading" className="text-base font-semibold">
        Consent documents
      </h2>
      {ordered.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="consent-summary">
            {NO_DOCUMENTS}
          </p>
          {canEdit ? (
            <form action={prepare}>
              <input type="hidden" name="client_id" value={clientId} />
              <SubmitButton variant="outline" icon={<FilePlusIcon aria-hidden="true" data-icon="inline-start" />}>
                Prepare consent documents
              </SubmitButton>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-lg border" data-testid="consent-documents">
            {ordered.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <Link
                  href={`/clients/${clientId}/documents/${doc.id}`}
                  className="font-medium underline-offset-3 hover:underline"
                >
                  {consentTitle(doc.kind)}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground" data-testid="consent-state">
                    {documentState(doc)}
                  </span>
                  {canEdit && !doc.signed_at ? (
                    <form action={sign}>
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="document_id" value={doc.id} />
                      <SubmitButton
                        variant="outline"
                        size="sm"
                        icon={<SignatureIcon aria-hidden="true" data-icon="inline-start" />}
                      >
                        Mark as signed
                      </SubmitButton>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium" data-testid="consent-summary">
            {signaturesLine(ordered)}
          </p>
        </>
      )}
    </section>
  );
}
