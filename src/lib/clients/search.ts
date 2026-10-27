// Пошук клієнта під час утримання слоту (припущення PM #19, AC-CARD-02): за ім'ям або email; дитину — і за email
// опікуна. Пошуку в самому списку клієнтів немає — він поза межами.
import type { ClientRow } from "@/lib/holds/types";

export function matchesClient(client: Pick<ClientRow, "name" | "email" | "guardian_email">, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [client.name, client.email, client.guardian_email].some((value) => value?.toLowerCase().includes(needle));
}
