import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";

// Результат дії з адреси (?ok= / ?error=): успіх — role="status", помилка — role="alert"; тексти — дослівно з AC.
export function ActionAlerts({ error, ok }: { error?: string; ok?: string }) {
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon strokeWidth={1.5} aria-hidden="true" />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      {ok ? (
        <Alert role="status">
          <CircleCheckIcon strokeWidth={1.5} aria-hidden="true" />
          <AlertTitle>{ok}</AlertTitle>
        </Alert>
      ) : null}
    </>
  );
}
