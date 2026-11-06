import { ShieldCheckIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { INSURANCE_CHOICES, INSURANCE_LABEL, insuranceLine, type InsuranceStatus } from "@/lib/clients/insurance";

// Статус перевірки страхування в картці (AC-INS-01…04): рядок «Insurance: <статус>» бачить кожен, хто бачить картку;
// форму — лише планувальник і адміністратор (терапевту змінити не запропоновано, AC-INS-04).
export function InsuranceSection({
  clientId,
  status,
  canEdit,
  action,
}: {
  clientId: string;
  status: string;
  canEdit: boolean;
  /** Дія збереження (`setInsuranceStatus`) — параметром, щоб розділ рендерився й без серверного модуля. */
  action: (formData: FormData) => Promise<void>;
}) {
  const current = (INSURANCE_CHOICES as readonly string[]).includes(status) ? status : "";
  return (
    <section className="mt-4 flex flex-col gap-3 border-t pt-4">
      <p className="text-sm font-medium" data-testid="insurance">
        {insuranceLine(status)}
      </p>
      {canEdit ? (
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="insurance_status">Insurance status</Label>
            <NativeSelect id="insurance_status" name="insurance_status" defaultValue={current} required>
              <NativeSelectOption value="" disabled>
                Select…
              </NativeSelectOption>
              {INSURANCE_CHOICES.map((choice: InsuranceStatus) => (
                <NativeSelectOption key={choice} value={choice}>
                  {INSURANCE_LABEL[choice]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <SubmitButton variant="outline" icon={<ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />}>
            Save insurance status
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}
