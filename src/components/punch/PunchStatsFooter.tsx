import { Rocket } from "lucide-react";
import { usePunchTokenCount } from "@/hooks/usePunchTokenCount";
import { usePunchPageStats } from "@/hooks/usePunchPageStats";

export function PunchStatsFooter() {
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors } = usePunchPageStats();

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      borderTop: "1px solid rgba(250,204,21,0.15)",
      background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,10,0,0.95) 100%)",
      backdropFilter: "blur(6px)", padding: "6px 16px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
      fontSize: 11, color: "rgba(255,255,255,0.4)", pointerEvents: "none",
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
    </div>
  );
}
