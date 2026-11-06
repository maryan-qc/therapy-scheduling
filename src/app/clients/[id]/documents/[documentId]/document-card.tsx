import { InfoIcon, SignatureIcon } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { documentState, SIGN_STAFF_ONLY, type ConsentDocumentRow, type DocumentText } from "@/lib/clients/consent";

// Текст документа згоди англійською (AC-DOC-04) і його стан. Персонал позначає непідписаний документ підписаним
// (AC-DOC-05, 06); свій терапевт замість кнопки бачить «Only schedulers and admins can mark documents as signed.»
// (AC-DOC-09). Дія — параметром, щоб картка рендерилась і без серверного модуля.
export function DocumentCard({
  clientId,
  document,
  text,
  canSign,
  sign,
}: {
  clientId: string;
  document: ConsentDocumentRow;
  text: DocumentText;
  canSign: boolean;
  sign: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">{text.title}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm" data-testid="consent-document">
        <div className="flex flex-col gap-1">
          {text.lines.map((line) => (
            <p key={line} className="tabular-nums">
              {line}
            </p>
          ))}
        </div>
        <p>{text.body}</p>
        <p className="border-t pt-4 font-medium tabular-nums" data-testid="consent-state">
          Status: {documentState(document)}
        </p>
        {canSign ? <SignForm clientId={clientId} document={document} sign={sign} /> : <StaffOnlyNote />}
      </CardContent>
    </Card>
  );
}

function SignForm({
  clientId,
  document,
  sign,
}: {
  clientId: string;
  document: ConsentDocumentRow;
  sign: (formData: FormData) => Promise<void>;
}) {
  if (document.signed_at) return null;
  return (
    <form action={sign}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="document_id" value={document.id} />
      <input type="hidden" name="back" value="document" />
      <SubmitButton variant="outline" icon={<SignatureIcon aria-hidden="true" data-icon="inline-start" />}>
        Mark as signed
      </SubmitButton>
    </form>
  );
}

function StaffOnlyNote() {
  return (
    <Alert role="status">
      <InfoIcon strokeWidth={1.5} aria-hidden="true" />
      <AlertTitle>{SIGN_STAFF_ONLY}</AlertTitle>
    </Alert>
  );
}
