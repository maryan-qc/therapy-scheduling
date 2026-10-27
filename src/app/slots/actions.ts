"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CONFIRM_CODES, HOLD_CODES } from "@/lib/holds/messages";
import { readCode } from "@/lib/holds/rules";
import { requireViewer } from "@/lib/supabase/viewer";

/** Повертаємось на сторінку, з якої прийшла форма (слоти дня або список утримань), з кодом результату в адресі. */
function backTo(formData: FormData, key: "error" | "ok", code: string): string {
  const raw = String(formData.get("back") ?? "");
  const allowed = raw.startsWith("/slots") || raw.startsWith("/holds");
  const url = new URL(allowed ? raw : "/slots", "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("ok");
  url.searchParams.set(key, code);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function revalidateSchedule() {
  revalidatePath("/slots");
  revalidatePath("/holds");
  revalidatePath("/schedule");
}

// Утримання: усі перевірки й запис — одна транзакція у функції бази hold_slot (AC-HOLD-02…08, 17, 25, 26).
// Роль сторінка не перевіряє: терапевту відмовляє сама база (HOLD_FORBIDDEN, AC-HOLD-08).
export async function holdSlot(formData: FormData) {
  const viewer = await requireViewer();
  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) redirect(backTo(formData, "error", "hold.CLIENT_REQUIRED"));

  const { data, error } = await viewer.supabase.rpc("hold_slot", {
    p_slot_id: String(formData.get("slot_id") ?? ""),
    p_client_id: clientId,
  });
  const code = error ? "NOT_FOUND" : readCode(data, HOLD_CODES, "NOT_FOUND");
  revalidateSchedule();
  redirect(backTo(formData, code === "OK" ? "ok" : "error", `hold.${code}`));
}

// Підтвердження: перевірки й запис — функція бази confirm_hold (AC-HOLD-12…14, 19, 22, 23, 27, 36).
export async function confirmHold(formData: FormData) {
  const viewer = await requireViewer();
  const { data, error } = await viewer.supabase.rpc("confirm_hold", {
    p_hold_id: String(formData.get("hold_id") ?? ""),
  });
  const code = error ? "NOT_FOUND" : readCode(data, CONFIRM_CODES, "NOT_FOUND");
  revalidateSchedule();
  redirect(backTo(formData, code === "OK" ? "ok" : "error", `confirm.${code}`));
}
