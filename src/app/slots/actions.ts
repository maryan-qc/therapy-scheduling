"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientErrorCode, validateClient } from "@/lib/holds/clients";
import { isStaff } from "@/lib/holds/types";
import { requireViewer } from "@/lib/supabase/viewer";

/** Повертаємось на ту саму сторінку слотів (терапевт і дата), з кодом результату в адресі. */
function backTo(formData: FormData, key: "error" | "ok", code: string): string {
  const raw = String(formData.get("back") ?? "");
  const url = new URL(raw.startsWith("/slots") ? raw : "/slots", "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("ok");
  url.searchParams.set(key, code);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

// Картка клієнта — лише ім'я та email; створюють планувальник або адміністратор (AC-HOLD-10, 11, 15, 16, 34, 35).
export async function addClient(formData: FormData) {
  const viewer = await requireViewer();
  if (!isStaff(viewer.role)) redirect(backTo(formData, "error", "CLIENT_FORBIDDEN"));

  const input = validateClient(String(formData.get("name") ?? ""), String(formData.get("email") ?? ""));
  if (!input.ok) redirect(backTo(formData, "error", input.code));

  const { error } = await viewer.supabase.from("clients").insert({ name: input.name, email: input.email });
  if (error) redirect(backTo(formData, "error", clientErrorCode(error.code)));

  revalidatePath("/slots");
  redirect(backTo(formData, "ok", "CLIENT_CREATED"));
}
