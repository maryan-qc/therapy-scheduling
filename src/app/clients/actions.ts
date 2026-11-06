"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cardErrorCode, cardRoleError, validateClientCard, type CardErrorCode, type CardForm } from "@/lib/clients/card";
import { CONSENT_MESSAGES, type ConsentErrorCode } from "@/lib/clients/consent";
import { insuranceResult } from "@/lib/clients/insurance";
import { readCode } from "@/lib/holds/rules";
import { practiceDate } from "@/lib/holds/time";
import { requireViewer } from "@/lib/supabase/viewer";

export interface CardFormState {
  errors: CardErrorCode[];
  values: CardForm;
}

function readCardForm(formData: FormData): CardForm {
  const field = (name: string) => String(formData.get(name) ?? "");
  return {
    type: field("type"),
    name: field("name"),
    dateOfBirth: field("date_of_birth"),
    language: field("session_language"),
    email: field("email"),
    guardianName: field("guardian_name"),
    guardianEmail: field("guardian_email"),
  };
}

// Картка клієнта з анкети (AC-CARD-01, 02, 03, 06): вхід і роль перевіряє дія, а не сторінка — Server Action можна
// викликати напряму. Запис — клієнтом користувача, тож діють RLS (clients_insert_staff) і колонковий GRANT.
export async function createClientCard(_previous: CardFormState, formData: FormData): Promise<CardFormState> {
  const values = readCardForm(formData);
  const viewer = await requireViewer();
  const roleError = cardRoleError(viewer.role);
  if (roleError) return { errors: [roleError], values };

  const input = validateClientCard(values, practiceDate(new Date()));
  if (!input.ok) return { errors: input.errors, values };

  const { data, error } = await viewer.supabase.from("clients").insert(input.row).select("id").single();
  if (error || !data) return { errors: [cardErrorCode(error?.code, error?.message)], values };

  revalidatePath("/clients");
  revalidatePath("/slots");
  redirect(`/clients/${data.id}?ok=created`);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Спільний початок дій картки: id клієнта з форми (некоректний — на список) і вхід. */
async function cardAction(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  if (!UUID.test(clientId)) redirect("/clients");
  return { clientId, viewer: await requireViewer() };
}

// Статус перевірки страхування (AC-INS-02, 03, 05): хто може позначати й які значення, перевіряє функція бази
// set_insurance_status, тож прямий виклик дії терапевтом нічого не змінює.
export async function setInsuranceStatus(formData: FormData): Promise<void> {
  const { clientId, viewer } = await cardAction(formData);
  const { data, error } = await viewer.supabase.rpc("set_insurance_status", {
    p_client_id: clientId,
    p_status: String(formData.get("insurance_status") ?? ""),
  });
  const code = error ? "SAVE_FAILED" : insuranceResult((data as { code?: unknown } | null)?.code);
  revalidatePath(`/clients/${clientId}`);
  redirect(code === "OK" ? `/clients/${clientId}?ok=insurance` : `/clients/${clientId}?error=insurance.${code}`);
}

const CONSENT_CODES = ["OK", ...Object.keys(CONSENT_MESSAGES)] as ("OK" | ConsentErrorCode)[];

// Документи згоди (AC-DOC-02, 03, 05, 06, 09): хто формує й позначає підпис і скільки документів, перевіряє функція
// бази, тож прямий виклик дії терапевтом нічого не змінює. Після дії — назад на картку чи на сторінку документа.
export async function prepareConsentDocuments(formData: FormData): Promise<void> {
  const { clientId, viewer } = await cardAction(formData);
  const { data, error } = await viewer.supabase.rpc("prepare_consent_documents", { p_client_id: clientId });
  const code = error ? "SAVE_FAILED" : readCode(data, CONSENT_CODES, "SAVE_FAILED");
  revalidatePath(`/clients/${clientId}`);
  redirect(code === "OK" ? `/clients/${clientId}` : `/clients/${clientId}?error=consent.${code}`);
}

export async function signConsentDocument(formData: FormData): Promise<void> {
  const { clientId, viewer } = await cardAction(formData);
  const documentId = String(formData.get("document_id") ?? "");
  if (!UUID.test(documentId)) redirect(`/clients/${clientId}`);
  const { data, error } = await viewer.supabase.rpc("sign_consent_document", { p_document_id: documentId });
  const code = error ? "SAVE_FAILED" : readCode(data, CONSENT_CODES, "SAVE_FAILED");
  const page =
    formData.get("back") === "document" ? `/clients/${clientId}/documents/${documentId}` : `/clients/${clientId}`;
  revalidatePath(`/clients/${clientId}`, "layout");
  redirect(code === "OK" ? page : `${page}?error=consent.${code}`);
}
