import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { isStaff, type Role } from "@/lib/holds/types";

type Section = "/slots" | "/holds" | "/schedule";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scheduler: "Scheduler", therapist: "Therapist" };

function NavLink({ href, current, children }: { href: Section; current?: Section; children: string }) {
  const active = href === current;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" })}
    >
      {children}
    </Link>
  );
}

export function Nav({ email, role, current }: { email: string | null; role: Role | null; current?: Section }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-content items-center gap-4 px-6 text-sm">
        <span className="font-semibold">Therapy scheduling</span>
        <nav className="flex gap-1">
          <NavLink href="/slots" current={current}>
            Slots
          </NavLink>
          {isStaff(role) ? (
            <NavLink href="/holds" current={current}>
              Holds
            </NavLink>
          ) : (
            <NavLink href="/schedule" current={current}>
              My schedule
            </NavLink>
          )}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-muted-foreground" data-testid="viewer">
          <span className="truncate">{email ?? "—"}</span>
          <Badge variant="outline">{role ? ROLE_LABEL[role] : "No role"}</Badge>
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
