"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatTimeLeft } from "@/lib/holds/time";

const HOUR = 60 * 60_000;

// Живий відлік після «Held until …» (DESIGN.md, розділ 6). Перший рендер — з часом сервера, тож HTML сервера й клієнта
// збігаються. Далі час іде від тієї самої серверної точки: різницю годинників сервера й браузера міряємо один раз, тож
// годинник браузера, що відстає чи поспішає, не зсуває кінець утримання. Date.now(), а не performance.now(): він не
// стоїть, поки ноутбук спить. Коли час вийшов, сторінка перечитує дані з сервера, і статус змінюється (Free у слотах,
// Expired у списку утримань) без перезавантаження. Без aria-live: щохвилинні оголошення лише заважали б.
export function HoldCountdown({ until, now }: { until: string; now: number }) {
  const router = useRouter();
  const [current, setCurrent] = useState(now);
  const left = new Date(until).getTime() - current;
  const expired = left <= 0;

  useEffect(() => {
    const skew = now - Date.now();
    const timer = setInterval(() => setCurrent(Date.now() + skew), 15_000);
    return () => clearInterval(timer);
  }, [now]);

  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  return (
    <span
      className={left < HOUR ? "font-medium text-status-held-foreground" : "text-muted-foreground"}
      data-testid="time-left"
    >
      {` · ${formatTimeLeft(left)}`}
    </span>
  );
}
