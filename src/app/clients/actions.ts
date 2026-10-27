"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cardErrorCode, cardRoleError, validateClientCard, type CardErrorCode, type CardForm } from "@/lib/clients/card";
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
