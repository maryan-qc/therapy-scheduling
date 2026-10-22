import { PRACTICE_TIME_ZONE } from "@/lib/holds/time";

// Увесь час — у поясі практики, і кожен екран з часом це підписує (DESIGN.md, розділ 7).
export function TimeZoneNote() {
  return <p className="text-small text-muted-foreground">Time zone: {PRACTICE_TIME_ZONE}</p>;
}
