// Поточний користувач для Server Components і Server Actions: getClaims() (перевіряє JWT), роль — з profiles.
import { redirect } from "next/navigation";
import type { Role } from "@/lib/holds/types";
import { createClient } from "./server";

const ROLES: readonly Role[] = ["admin", "scheduler", "therapist"];

export async function requireViewer() {
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
  return {
    supabase,
    id: claims.sub,
    email: profile?.email ?? claims.email ?? null,
    fullName: profile?.full_name ?? null,
    role,
  };
}
