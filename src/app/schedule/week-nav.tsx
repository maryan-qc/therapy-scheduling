import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { addDays } from "@/lib/holds/time";

// Перемикання тижнів у розкладі терапевта (AC-HOLD-30, AC-HOLD-31): попередній, діапазон пн–нд, наступний.
export function WeekNav({ monday, sunday }: { monday: string; sunday: string }) {
  const link = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link href={`/schedule?week=${addDays(monday, -7)}`} className={link}>
        <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
        Previous week
      </Link>
      <span className="font-medium tabular-nums" data-testid="week">
        {monday} – {sunday}
      </span>
      <Link href={`/schedule?week=${addDays(monday, 7)}`} className={link}>
        Next week
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Link>
    </div>
  );
}
