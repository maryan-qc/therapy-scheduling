import { CalendarHeartIcon } from "lucide-react";

// Знак застосунку в шапці й на сторінці входу: іконка в квадраті primary і назва.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-semibold ${className ?? ""}`}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <CalendarHeartIcon className="size-4" aria-hidden="true" />
      </span>
      Therapy scheduling
    </span>
  );
}
