// Документи згоди клієнта (openspec/specs/consent-documents). Набір, хто формує й позначає підпис і вплив на
// підтвердження тримає база (supabase/migrations/20261106180000_consent_documents.sql); тут — що бачить людина.
import { formatPracticeDateTime, practiceDate } from "@/lib/holds/time";

export type ConsentKind = "consent_to_treatment" | "cancellation_policy" | "release_of_information";

/** Назви документів у порядку набору: «Adult» — перші два, «Child» — усі три (припущення PM, #34). */
export const CONSENT_TITLE: Record<ConsentKind, string> = {
  consent_to_treatment: "Consent to treatment",
  cancellation_policy: "Cancellation policy acknowledgement",
  release_of_information: "Release of information",
};

export interface ConsentDocumentRow {
  id: string;
  client_id: string;
  kind: string;
  position: number;
  prepared_at: string;
  signed_at: string | null;
}

export const CONSENT_COLUMNS = "id, client_id, kind, position, prepared_at, signed_at" as const;

export const NO_DOCUMENTS = "No consent documents yet."; // AC-DOC-01
export const ALL_SIGNED = "All consent documents signed."; // AC-DOC-06
export const SIGN_STAFF_ONLY = "Only schedulers and admins can mark documents as signed."; // AC-DOC-09

export function consentTitle(kind: string): string {
  return CONSENT_TITLE[kind as ConsentKind] ?? kind;
}

/** Документи в порядку набору (база віддає їх у будь-якому порядку). */
export function inSetOrder<T extends Pick<ConsentDocumentRow, "position">>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => a.position - b.position);
}

/** «Not signed» або «Signed РРРР-ММ-ДД ГГ:ХХ» у часі практики (AC-DOC-02, AC-DOC-05). */
export function documentState(doc: Pick<ConsentDocumentRow, "signed_at">): string {
  return doc.signed_at ? `Signed ${formatPracticeDateTime(doc.signed_at)}` : "Not signed";
}

/** Рядок картки: документів немає / яких підписів бракує / усі підписані (AC-DOC-01, 02, 05, 06). */
export function signaturesLine(docs: readonly Pick<ConsentDocumentRow, "kind" | "position" | "signed_at">[]): string {
  if (docs.length === 0) return NO_DOCUMENTS;
  const missing = inSetOrder(docs).filter((doc) => !doc.signed_at);
  return missing.length === 0 ? ALL_SIGNED : `Missing signatures: ${missing.map((doc) => consentTitle(doc.kind)).join(", ")}`;
}

/** Сталий текст згоди — синтетичний, без справжніх назв і правил практики (припущення PM, #34). */
const BODY: Record<ConsentKind, string> = {
  consent_to_treatment:
    "I agree to take part in therapy sessions with a therapist of the practice. I understand that I can ask questions about the treatment at any time and can stop the treatment at any time.",
  cancellation_policy:
    "I have read the practice's cancellation policy. I understand that sessions are cancelled or moved in advance through the practice's scheduler.",
  release_of_information:
    "I allow the practice to share information about the client's treatment with the guardian named in this document. This permission applies only to the client named in this document.",
};

export interface DocumentText {
  title: string;
  lines: string[];
  body: string;
}

/**
 * Текст документа англійською: заголовок, «Client: …», для дитини — «Guardian: …», «Prepared: РРРР-ММ-ДД» і сталий
 * текст (AC-DOC-04).
 */
export function documentText(
  doc: Pick<ConsentDocumentRow, "kind" | "prepared_at">,
  client: { name: string; client_type: string; guardian_name: string | null },
): DocumentText {
  const lines = [`Client: ${client.name}`];
  if (client.client_type === "child" && client.guardian_name) lines.push(`Guardian: ${client.guardian_name}`);
  lines.push(`Prepared: ${practiceDate(new Date(doc.prepared_at))}`);
  return { title: consentTitle(doc.kind), lines, body: BODY[doc.kind as ConsentKind] ?? "" };
}

export type ConsentErrorCode =
  | "PREPARE_FORBIDDEN"
  | "SIGN_FORBIDDEN"
  | "ALREADY_PREPARED"
  | "ALREADY_SIGNED"
  | "NOT_FOUND"
  | "SAVE_FAILED";

// PM дала тексти для відмови терапевту в підписі (AC-DOC-09); решта — власні: сторінка цих дій не пропонує, тож їх
// побачить лише той, хто викликав дію напряму чи двічі.
export const CONSENT_MESSAGES: Record<ConsentErrorCode, string> = {
  PREPARE_FORBIDDEN: "Only schedulers and admins can prepare consent documents.",
  SIGN_FORBIDDEN: SIGN_STAFF_ONLY,
  ALREADY_PREPARED: "Consent documents are already prepared.",
  ALREADY_SIGNED: "This document is already signed.",
  NOT_FOUND: "This consent document doesn't exist.",
  SAVE_FAILED: "The consent documents were not saved. Try again.",
};
