import { CalendarDaysIcon, CalendarRangeIcon, HourglassIcon, LogOutIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Brand } from "@/app/_components/brand";
import { signOut } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { isStaff, type Role } from "@/lib/holds/types";

type Section = "/slots" | "/holds" | "/schedule" | "/clients";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scheduler: "Scheduler", therapist: "Therapist" };

// Іконки — лише поруч зі словом (DESIGN.md, розділ 5): назва пункту для людей і тестів не змінюється.
function NavLink({
  href,
  current,
  icon: Icon,
  children,
}: {
  href: Section;
  current?: Section;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  children: string;
}) {
  const active = href === current;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" })}
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {children}
    </Link>
  );
}

export function Nav({ email, role, current }: { email: string | null; role: Role | null; current?: Section }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-content items-center gap-4 px-6 text-sm">
        <Brand />
        <nav className="flex gap-1">
          {isStaff(role) ? (
            <>
              <NavLink href="/slots" current={current} icon={CalendarDaysIcon}>
                Slots
              </NavLink>
              <NavLink href="/holds" current={current} icon={HourglassIcon}>
                Holds
              </NavLink>
            </>
          ) : (
            <NavLink href="/schedule" current={current} icon={CalendarRangeIcon}>
              My schedule
            </NavLink>
          )}
          {role ? (
            <NavLink href="/clients" current={current} icon={UsersIcon}>
              {isStaff(role) ? "Clients" : "My clients"}
            </NavLink>
          ) : null}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-muted-foreground" data-testid="viewer">
          <span className="truncate">{email ?? "—"}</span>
          <Badge variant="outline">{role ? ROLE_LABEL[role] : "No role"}</Badge>
        </span>
        <form action={signOut}>
          <SubmitButton variant="ghost" size="sm" icon={<LogOutIcon aria-hidden="true" data-icon="inline-start" />}>
            Sign out
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}
