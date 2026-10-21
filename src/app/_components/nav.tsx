import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { isStaff, type Role } from "@/lib/holds/types";

export function Nav({ email, role }: { email: string | null; role: Role | null }) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 px-6 py-3 text-sm dark:border-zinc-800">
      <span className="font-semibold">Therapy scheduling</span>
      <nav className="flex gap-3">
        <Link href="/slots" className="underline-offset-4 hover:underline">
          Slots
        </Link>
        {isStaff(role) ? (
          <Link href="/holds" className="underline-offset-4 hover:underline">
            Holds
          </Link>
        ) : (
          <Link href="/schedule" className="underline-offset-4 hover:underline">
            My schedule
          </Link>
        )}
      </nav>
      <span className="ml-auto text-zinc-500" data-testid="viewer">
        {email ?? "—"} · {role ?? "no role"}
      </span>
      <form action={signOut}>
        <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
          Sign out
        </button>
      </form>
    </header>
  );
}
