// Статус перевірки страхування в картці клієнта (openspec/specs/insurance-status). Ті самі правила тримає база
// (supabase/migrations/20261106170000_insurance_status.sql): значення, «Not set» лише початковий, хто позначає.

export type InsuranceStatus = "not_set" | "verified" | "not_accepted" | "private_pay";

export const INSURANCE_LABEL: Record<InsuranceStatus, string> = {
  not_set: "Not set",
  verified: "Verified",
  not_accepted: "Not accepted",
  private_pay: "Private pay",
};

/** Що можна позначити: «Not set» — лише початковий, повернути його не можна (припущення PM, #33). */
export const INSURANCE_CHOICES = ["verified", "not_accepted", "private_pay"] as const satisfies InsuranceStatus[];

/** Рядок картки «Insurance: <статус>» — текстом, не лише кольором (AC-INS-01…06). */
export function insuranceLine(status: string): string {
  return `Insurance: ${INSURANCE_LABEL[status as InsuranceStatus] ?? INSURANCE_LABEL.not_set}`;
}

export const INSURANCE_SAVED = "Insurance status saved."; // AC-INS-02

export type InsuranceErrorCode = "INSURANCE_FORBIDDEN" | "INVALID_STATUS" | "NOT_FOUND" | "SAVE_FAILED";

// PM дала текст лише для успіху; відмови — власні тексти: сторінка терапевту форми не показує (AC-INS-04), тож їх
// побачить лише той, хто викликав дію напряму.
export const INSURANCE_MESSAGES: Record<InsuranceErrorCode, string> = {
  INSURANCE_FORBIDDEN: "Only schedulers and admins can change the insurance status.",
  INVALID_STATUS: "Select an insurance status.",
  NOT_FOUND: "This client card doesn't exist.",
  SAVE_FAILED: "The insurance status was not saved. Try again.",
};

/** Код відповіді функції бази set_insurance_status → код повідомлення сторінки. */
export function insuranceResult(code: unknown): "OK" | InsuranceErrorCode {
  return code === "OK" || (typeof code === "string" && code in INSURANCE_MESSAGES)
    ? (code as "OK" | InsuranceErrorCode)
    : "SAVE_FAILED";
}
