import { useEffect, useState } from "react";
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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center md:pl-[160px]"
      style={{
        height: "40px",
        background: "#111114",
        borderTop: "1px solid #2a2a2a",
      }}
    >
      <div className="flex items-center justify-between w-full px-4 overflow-x-auto">
        {/* Stats */}
        <div className="flex items-center gap-0 shrink-0">
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
        <div className="flex items-center gap-2 shrink-0 ml-6">
          <span
            className={`inline-block w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
          />
          <span
            className="font-mono text-xs font-medium"
            style={{ color: isOnline ? "#22c55e" : "#ef4444" }}
          >
            {isOnline ? "Connection is stable" : "Disconnected"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <span className="font-mono text-xs uppercase tracking-wide" style={{ color: "#888" }}>
        {label}
      </span>
      <span className="font-mono text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function Divider() {
  return (
    <span className="font-mono text-xs" style={{ color: "#333" }}>
      |
    </span>
  );
}
