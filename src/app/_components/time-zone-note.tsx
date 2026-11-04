import { StatusGuide } from "@/components/ui/status-badge";
import { PRACTICE_TIME_ZONE } from "@/lib/holds/time";

// Увесь час — у поясі практики, і кожен екран з часом це підписує (DESIGN.md, розділ 7). Усі ці екрани показують і
// статуси слотів, тож поруч — довідка про статуси (одна на сторінку, відкривається натисканням).
export function TimeZoneNote() {
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p className="text-small text-muted-foreground">Time zone: {PRACTICE_TIME_ZONE}</p>
      <StatusGuide />
    </div>
  );
}
