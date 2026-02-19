import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { Card } from "@/components/ui/card";

const LAUNCH_TARGET = "2026-02-18T08:00:00Z";

function useCountdownTo(target: string) {
  const [state, setState] = useState({ h: 0, m: 0, s: 0, expired: true });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setState({ h: 0, m: 0, s: 0, expired: true });
        return;
      }
      setState({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return state;
}

export function LaunchCountdown({ compact = false }: { compact?: boolean }) {
  const { h, m, s, expired } = useCountdownTo(LAUNCH_TARGET);

  if (expired) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary/10 border border-primary/30">
        <Timer className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-primary">Token is almost ready to go Live</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-card border border-border">
        <Timer className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Token Launch</span>
        <div className="flex items-center gap-1 font-mono text-lg font-bold text-foreground">
          <span className="bg-secondary rounded px-1.5 py-0.5">{h.toString().padStart(2, "0")}</span>
          <span className="text-muted-foreground">:</span>
          <span className="bg-secondary rounded px-1.5 py-0.5">{m.toString().padStart(2, "0")}</span>
          <span className="text-muted-foreground">:</span>
          <span className="bg-secondary rounded px-1.5 py-0.5">{s.toString().padStart(2, "0")}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4 sm:p-6 bg-primary/5 border-primary/30 text-center space-y-3">
      <div className="flex items-center justify-center gap-2 text-primary">
        <Timer className="w-5 h-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Token Launch</span>
      </div>
      <div className="flex justify-center gap-2 sm:gap-4">
        {[
          { value: h, label: "Hours" },
          { value: m, label: "Min" },
          { value: s, label: "Sec" },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="bg-card border border-border rounded-lg w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
                {value.toString().padStart(2, "0")}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">New $CLAW launches when the timer hits zero</p>
    </Card>
  );
}
