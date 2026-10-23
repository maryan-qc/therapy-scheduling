// Поточний користувач для Server Components і Server Actions: getClaims() (перевіряє JWT), роль — з profiles.
import { redirect } from "next/navigation";
import type { Role } from "@/lib/holds/types";
import { createClient } from "./server";

const ROLES: readonly Role[] = ["admin", "scheduler", "therapist"];

// Без ролі (role null або профілю немає) — лише головна з повідомленням AC-CARD-11; інші сторінки й дії туди
// перенаправляють. Даних клієнтів така людина й так не отримає: RLS не дає їй жодного рядка.
export async function requireViewer({ allowNoRole = false }: { allowNoRole?: boolean } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const role = ROLES.find((candidate) => candidate === profile?.role) ?? null;
  if (!role && !allowNoRole) redirect("/");
  return {
    supabase,
    id: claims.sub,
    email: profile?.email ?? claims.email ?? null,
    fullName: profile?.full_name ?? null,
    role,
  };
}
