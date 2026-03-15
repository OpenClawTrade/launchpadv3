import { useState, useEffect, useRef } from "react";

function formatTickingAge(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

function getInterval(ms: number): number {
  if (ms < 3_600_000) return 1000;      // < 1h → tick every 1s
  if (ms < 86_400_000) return 30_000;   // < 24h → tick every 30s
  return 60_000;                         // else → tick every 60s
}

export function useTickingAge(createdAt: string | null | undefined, isUnixSeconds = false): string {
  const getMs = () => {
    if (!createdAt) return 0;
    try {
      const ts = isUnixSeconds ? parseInt(createdAt) * 1000 : new Date(createdAt).getTime();
      return Math.max(0, Date.now() - ts);
    } catch {
      return 0;
    }
  };

  const [age, setAge] = useState(() => formatTickingAge(getMs()));
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const update = () => {
      const ms = getMs();
      setAge(formatTickingAge(ms));
      // Adjust interval if needed
      const newInterval = getInterval(ms);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const ms2 = getMs();
        setAge(formatTickingAge(ms2));
      }, newInterval);
    };
    update();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [createdAt, isUnixSeconds]);

  return createdAt ? age : "?";
}
