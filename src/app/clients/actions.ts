"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cardErrorCode, cardRoleError, validateClientCard, type CardErrorCode, type CardForm } from "@/lib/clients/card";
import { productModel } from "@/lib/ai/openrouter";
import { insuranceResult } from "@/lib/clients/insurance";
import { draftIntake, type IntakeDraftResponse } from "@/lib/clients/intake-draft";
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

// Чернетка картки з тексту звернення (AC-INTAKE-01…09): вхід і роль — requireViewer (getClaims + profiles) ДО
// звернення до моделі; роль перевіряє draftIntake. Дія нічого не пише й текст не зберігає: картку створює лише
// createClientCard, коли людина натисне «Create client card» (AC-INTAKE-03).
export async function requestIntakeDraft(text: string): Promise<IntakeDraftResponse> {
  const viewer = await requireViewer();
  return draftIntake({
    role: viewer.role,
    text: typeof text === "string" ? text : "",
    model: productModel(),
    today: practiceDate(new Date()),
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Статус перевірки страхування (AC-INS-02, 03, 05): хто може позначати й які значення, перевіряє функція бази
// set_insurance_status, тож прямий виклик дії терапевтом нічого не змінює.
export async function setInsuranceStatus(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  if (!UUID.test(clientId)) redirect("/clients");
  const viewer = await requireViewer();
  const { data, error } = await viewer.supabase.rpc("set_insurance_status", {
    p_client_id: clientId,
    p_status: String(formData.get("insurance_status") ?? ""),
  });
  const code = error ? "SAVE_FAILED" : insuranceResult((data as { code?: unknown } | null)?.code);
  revalidatePath(`/clients/${clientId}`);
  redirect(code === "OK" ? `/clients/${clientId}?ok=insurance` : `/clients/${clientId}?error=${code}`);
}
