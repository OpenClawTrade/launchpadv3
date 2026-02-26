import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePunchTokenCount() {
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = async () => {
    const { count: total } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .eq("launchpad_type", "punch");
    setCount(total ?? 0);
  };

  useEffect(() => {
    fetchCount();

    const channel = supabase
      .channel("punch-token-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fun_tokens" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
