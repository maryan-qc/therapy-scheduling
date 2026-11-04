import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { addDays } from "@/lib/holds/time";

/** Адреса /slots на інший день з тим самим терапевтом і пошуком клієнта. */
export function slotsHref(therapistId: string, date: string, client: string): string {
  return `/slots?${new URLSearchParams({ therapist: therapistId, date, client }).toString()}`;
}

// Перехід між днями без поля дати — як «Previous week» / «Next week» у розкладі терапевта.
export function DayNav({
  therapistId,
  date,
  today,
  client,
}: {
  therapistId: string;
  date: string;
  today: string;
  client: string;
}) {
  const link = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <nav aria-label="Days" className="flex flex-wrap items-center gap-2">
      <Link href={slotsHref(therapistId, addDays(date, -1), client)} className={link}>
        <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
        Previous day
      </Link>
      <Link
        href={slotsHref(therapistId, today, client)}
        aria-current={date === today ? "date" : undefined}
        className={buttonVariants({ variant: date === today ? "secondary" : "outline", size: "sm" })}
      >
        Today
      </Link>
      <Link href={slotsHref(therapistId, addDays(date, 1), client)} className={link}>
        Next day
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Link>
    </nav>
  );
}
