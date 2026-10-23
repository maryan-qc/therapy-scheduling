// Рядки таблиць зрізу 1 у тому вигляді, у якому їх читають сторінки (див. supabase/migrations/…_slot_holds.sql).

export type Role = "admin" | "scheduler" | "therapist";

export interface TherapistRow {
  id: string;
  name: string;
  email: string;
}

export interface SlotRow {
  id: string;
  therapist_id: string;
  starts_at: string;
  ends_at: string;
}

export interface HoldRow {
  id: string;
  slot_id: string;
  client_id: string;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  released_at: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  /** У дитини власного email немає — контакт є email опікуна (AC-CARD-02). */
  email: string | null;
  guardian_email?: string | null;
}

/** Клієнт у розкладі терапевта: лише ім'я, без email (AC-HOLD-40). */
export type ClientName = Pick<ClientRow, "id" | "name">;

/** Контакт поруч з ім'ям клієнта: email дорослого або email опікуна дитини (AC-CARD-02). */
export function clientContact(client: Partial<Pick<ClientRow, "email" | "guardian_email">>): string {
  if (client.email) return client.email;
  return client.guardian_email ? `guardian: ${client.guardian_email}` : "";
}

export function isStaff(role: Role | null | undefined): boolean {
  return role === "scheduler" || role === "admin";
}
