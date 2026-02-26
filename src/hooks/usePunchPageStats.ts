import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

function getFingerprint(): string {
  const key = "punch_voter_id";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(key, fp);
  }
  return fp;
}

export function usePunchPageStats() {
  const [totalPunches, setTotalPunches] = useState<number | null>(null);
  const [uniqueVisitors, setUniqueVisitors] = useState<number | null>(null);
  const pendingPunches = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout>>();

  // Fetch initial stats
  useEffect(() => {
    const fetchStats = async () => {
      const [countersRes, visitorsRes] = await Promise.all([
        supabase.from("punch_counters").select("total_punches").eq("id", "global").single(),
        supabase.from("punch_visitors").select("id", { count: "exact", head: true }),
      ]);
      if (countersRes.data) setTotalPunches(countersRes.data.total_punches);
      if (visitorsRes.count !== null) setUniqueVisitors(visitorsRes.count);
    };
    fetchStats();

    // Register this visitor
    const fp = getFingerprint();
    supabase.from("punch_visitors").upsert({ fingerprint: fp }, { onConflict: "fingerprint" }).then(() => {});

    // Realtime for counter updates
    const channel = supabase
      .channel("punch-counters-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "punch_counters" }, (payload) => {
        if (payload.new && typeof payload.new.total_punches === "number") {
          setTotalPunches(payload.new.total_punches);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Batch punch reporting - accumulate taps and flush every 2 seconds
  const reportPunches = useCallback((count: number = 1) => {
    pendingPunches.current += count;
    setTotalPunches((prev) => (prev !== null ? prev + count : count));

    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      if (pendingPunches.current > 0) {
        const toFlush = pendingPunches.current;
        pendingPunches.current = 0;
        supabase.rpc("increment_punch_count", { p_count: toFlush }).then(() => {});
      }
    }, 2000);
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (pendingPunches.current > 0) {
        supabase.rpc("increment_punch_count", { p_count: pendingPunches.current }).then(() => {});
      }
    };
  }, []);

  return { totalPunches, uniqueVisitors, reportPunches };
}
