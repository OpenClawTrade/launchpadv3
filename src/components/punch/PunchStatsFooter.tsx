import { useState } from "react";
import { Rocket, Copy, CheckCircle } from "lucide-react";
import { usePunchTokenCount } from "@/hooks/usePunchTokenCount";
import { usePunchPageStats } from "@/hooks/usePunchPageStats";

const PUNCH_CA: string = "Coming Soon";

export function PunchStatsFooter() {
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors } = usePunchPageStats();
  const [copied, setCopied] = useState(false);

  const handleCopyCA = () => {
    if (PUNCH_CA === "Coming Soon") return;
    navigator.clipboard.writeText(PUNCH_CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      borderTop: "1px solid rgba(250,204,21,0.15)",
      background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,10,0,0.95) 100%)",
      backdropFilter: "blur(6px)", padding: "6px 16px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
      fontSize: 11, color: "rgba(255,255,255,0.4)", pointerEvents: "none",
      flexWrap: "wrap",
    }}>
      
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 12 }}>👊</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
          {totalPunches !== null ? totalPunches.toLocaleString() : "—"}
        </span>
        <span>punches</span>
      </div>
      <span style={{ color: "rgba(250,204,21,0.3)" }}>|</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 12 }}>🌴</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
          {uniqueVisitors !== null ? uniqueVisitors.toLocaleString() : "—"}
        </span>
        <span>punchers</span>
      </div>
      <span style={{ color: "rgba(250,204,21,0.3)" }}>|</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Rocket style={{ width: 12, height: 12, color: "#facc15" }} />
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
          {totalLaunched !== null ? totalLaunched.toLocaleString() : "—"}
        </span>
        <span>launched</span>
      </div>
      <span style={{ color: "rgba(250,204,21,0.3)" }}>|</span>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 5,
          pointerEvents: PUNCH_CA !== "Coming Soon" ? "auto" : "none",
          cursor: PUNCH_CA !== "Coming Soon" ? "pointer" : "default",
        }}
        onClick={handleCopyCA}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>CA:</span>
        <span style={{
          fontFamily: "monospace", fontWeight: 700, fontSize: 10,
          color: PUNCH_CA === "Coming Soon" ? "rgba(255,255,255,0.3)" : "#facc15",
          fontStyle: PUNCH_CA === "Coming Soon" ? "italic" : "normal",
        }}>
          {PUNCH_CA === "Coming Soon" ? "Coming Soon" : `${PUNCH_CA.slice(0, 4)}...${PUNCH_CA.slice(-4)}`}
        </span>
        {PUNCH_CA !== "Coming Soon" && (
          copied
            ? <CheckCircle style={{ width: 10, height: 10, color: "#22c55e" }} />
            : <Copy style={{ width: 10, height: 10, color: "rgba(255,255,255,0.3)" }} />
        )}
      </div>
    </div>
  );
}
