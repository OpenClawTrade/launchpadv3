import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useClawStats } from "@/hooks/useClawStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";

export function StickyStatsFooter() {
  const { data: stats } = useClawStats();
  const isMobile = useIsMobile();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { pathname } = useLocation();

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

  // Hide footer on punch pages and on punchlaunch.fun domain
  const isPunchDomain = typeof window !== "undefined" && (window.location.hostname === "punchlaunch.fun" || window.location.hostname === "www.punchlaunch.fun");
  if (pathname.startsWith("/punch") || pathname.startsWith("/punch-test") || isPunchDomain) return null;

  const tokens = stats?.totalTokensLaunched ?? 0;
  const agents = stats?.totalAgents ?? 0;
  const feesClaimed = (stats?.totalAgentFeesEarned ?? 0).toFixed(2);
  const agentPosts = stats?.totalAgentPosts ?? 0;
  const payouts = (stats?.totalAgentPayouts ?? 0).toFixed(2);

  const footer = (
    <div
      className="sticky-stats-footer"
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
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingLeft: "12px",
        paddingRight: "12px",
        gap: "8px",
        boxSizing: "border-box",
        overflow: "visible",
      }}>
        {/* Stats - horizontal scroll on mobile */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: "1 1 0%",
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          <StatItem label="TOKENS" value={tokens.toLocaleString()} />
          <Divider />
          <StatItem label="AGENTS" value={agents.toLocaleString()} />
          <Divider />
          <StatItem label="FEES" value={`${feesClaimed} SOL`} />
          <Divider />
          <StatItem label="POSTS" value={agentPosts.toLocaleString()} />
          <Divider />
          <StatItem label="PAYOUTS" value={`${payouts} SOL`} />
        </div>

        {/* Connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
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
              fontSize: "11px",
              fontWeight: 500,
              color: isOnline ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)",
              whiteSpace: "nowrap",
            }}
          >
            {isOnline ? "Connected" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(footer, document.body);
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(215 20% 55%)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 600, color: "hsl(210 40% 90%)" }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span style={{ color: "hsl(215 15% 30%)", fontSize: "11px", flexShrink: 0, padding: "0 2px" }}>|</span>
  );
}
