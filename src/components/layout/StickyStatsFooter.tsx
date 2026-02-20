import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useClawStats } from "@/hooks/useClawStats";

export function StickyStatsFooter() {
  const { data: stats } = useClawStats();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const tokens = stats?.totalTokensLaunched ?? 0;
  const agents = stats?.totalAgents ?? 0;
  const feesClaimed = (stats?.totalAgentFeesEarned ?? 0).toFixed(2);
  const agentPosts = stats?.totalAgentPosts ?? 0;
  const payouts = (stats?.totalAgentPayouts ?? 0).toFixed(2);

  const footer = (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "40px",
        zIndex: 99999,
        background: "hsl(225 40% 5%)",
        borderTop: "1px solid hsl(222 20% 14%)",
        display: "flex",
        alignItems: "center",
        paddingLeft: "160px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingLeft: "16px", paddingRight: "16px", overflowX: "auto" }}>
        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <StatItem label="TOKENS" value={tokens.toLocaleString()} />
          <Divider />
          <StatItem label="AGENTS" value={agents.toLocaleString()} />
          <Divider />
          <StatItem label="FEES CLAIMED" value={`${feesClaimed} SOL`} />
          <Divider />
          <StatItem label="AGENT POSTS" value={agentPosts.toLocaleString()} />
          <Divider />
          <StatItem label="PAYOUTS" value={`${payouts} SOL`} />
        </div>

        {/* Connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "24px" }}>
          <span
            className={isOnline ? "pulse-dot" : ""}
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isOnline ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)",
            }}
          />
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              fontWeight: 500,
              color: isOnline ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)",
            }}
          >
            {isOnline ? "Connection is stable" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(footer, document.body);
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Divider() {
  return (
    <span className="text-xs text-border-light">
      |
    </span>
  );
}
