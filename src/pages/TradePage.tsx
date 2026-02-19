import { useState, useEffect, useMemo, useRef } from "react";
import { Clock, Rocket, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

interface CountdownTimer {
  id: string;
  target_time: string;
  title: string;
  is_active: boolean;
}

// Accepts a string to avoid new Date() object reference churn
function useCountdown(targetTimeStr: string | null) {
  const targetMs = useMemo(
    () => (targetTimeStr ? new Date(targetTimeStr).getTime() : null),
    [targetTimeStr]
  );

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetMs) return;

    const calculate = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setIsExpired(false);
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    calculate();
    const id = setInterval(calculate, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return { timeLeft, isExpired };
}

// Jupiter Terminal component
function JupiterTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const SCRIPT_SRC = "https://terminal.jup.ag/main-v3.js";

    const initJupiter = () => {
      try {
        (window as any).Jupiter?.init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-terminal-container",
          endpoint: "https://api.mainnet-beta.solana.com",
          defaultExplorer: "Solscan",
          strictTokenList: false,
        });
        initialized.current = true;
        setStatus("ready");
      } catch (e) {
        console.error("[Jupiter] init error", e);
        setStatus("error");
      }
    };

    if ((window as any).Jupiter) {
      initJupiter();
      return;
    }

    // Load script if not present
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        // Small delay for Jupiter to register itself
        setTimeout(initJupiter, 300);
      };
      script.onerror = () => setStatus("error");
      document.body.appendChild(script);
    } else {
      // Script tag exists, poll for Jupiter
      const poll = setInterval(() => {
        if ((window as any).Jupiter) {
          clearInterval(poll);
          initJupiter();
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(poll);
        if (!(window as any).Jupiter) setStatus("error");
      }, 10000);
      return () => {
        clearInterval(poll);
        clearTimeout(timeout);
      };
    }
  }, []);

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-muted-foreground">Unable to load the trading terminal.</p>
        <a
          href="https://jup.ag"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline text-sm"
        >
          Trade directly on Jupiter →
        </a>
      </div>
    );
  }

  return (
    <div className="relative min-h-[600px]">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading terminal...</p>
          </div>
        </div>
      )}
      <div
        id="jupiter-terminal-container"
        ref={containerRef}
        className="w-full min-h-[600px]"
      />
    </div>
  );
}

const TimeBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-card border border-border rounded-xl w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shadow-lg">
      <span className="text-3xl sm:text-4xl font-bold text-primary">
        {value.toString().padStart(2, "0")}
      </span>
    </div>
    <span className="text-xs sm:text-sm text-muted-foreground mt-2 uppercase tracking-wider">
      {label}
    </span>
  </div>
);

export default function TradePage() {
  const [timer, setTimer] = useState<CountdownTimer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTimer() {
      const { data, error } = await supabase
        .from("countdown_timers")
        .select("*")
        .eq("id", "trade_launch")
        .maybeSingle();

      if (error) console.error("Error fetching countdown:", error);
      if (data) setTimer(data as CountdownTimer);
      setIsLoading(false);
    }

    fetchTimer();

    const channel = supabase
      .channel("countdown-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "countdown_timers", filter: "id=eq.trade_launch" },
        (payload) => {
          if (payload.new) setTimer(payload.new as CountdownTimer);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Stable string reference — no new Date() on every render
  const targetTimeStr = useMemo(
    () => timer?.target_time ?? null,
    [timer?.target_time]
  );

  const { timeLeft, isExpired } = useCountdown(targetTimeStr);

  return (
    <LaunchpadLayout>
      {isLoading ? (
        <div className="animate-pulse space-y-6 max-w-2xl mx-auto mt-16">
          <div className="h-10 bg-muted rounded w-3/4 mx-auto" />
          <div className="flex justify-center gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-20 h-20 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      ) : isExpired ? (
        // Trading is live — show Jupiter Terminal
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Terminal</h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
              <Zap className="h-3 w-3" />
              Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Swap any Solana token via the best DEX aggregator.
          </p>
          <Card className="overflow-hidden">
            <JupiterTerminal />
          </Card>
        </div>
      ) : (
        // Countdown still active
        <div className="flex items-center justify-center min-h-[calc(100vh-180px)]">
          <Card className="gate-card max-w-2xl w-full p-8 sm:p-12 text-center">
            <div className="space-y-8">
              <div className="space-y-2">
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {timer?.title || "Trading goes Live"}
                </h1>
                <p className="text-muted-foreground text-lg">
                  Get ready for the launch
                </p>
              </div>
              <div className="flex justify-center gap-3 sm:gap-6">
                <TimeBlock value={timeLeft.days} label="Days" />
                <TimeBlock value={timeLeft.hours} label="Hours" />
                <TimeBlock value={timeLeft.minutes} label="Minutes" />
                <TimeBlock value={timeLeft.seconds} label="Seconds" />
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Stay tuned! Trading will be available soon.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </LaunchpadLayout>
  );
}
