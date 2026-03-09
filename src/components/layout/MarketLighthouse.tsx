import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLaunchpadStats } from "@/hooks/useLaunchpadStats";
import pumpfunPill from "@/assets/pumpfun-pill.webp";
import bonkIcon from "@/assets/bonk-icon.jpg";
import meteoraIcon from "@/assets/meteora-icon.svg";
import bagsIcon from "@/assets/bags-icon.ico";
import moonshotIcon from "@/assets/moonshot-icon.ico";
import raydiumIcon from "@/assets/raydium-icon.ico";

const TIME_TABS = ["5m", "1h", "6h", "24h"] as const;

const LAUNCHPAD_ICONS: Record<string, string> = {
  pumpfun: pumpfunPill,
  bonk: bonkIcon,
  meteora: meteoraIcon,
  bags: bagsIcon,
  moonshot: moonshotIcon,
  raydium: raydiumIcon,
};

const PROTOCOL_DATA = [
  { name: "Pump.fun", icon: pumpfunPill, vol: "$694M", change: "+13.53%", positive: true },
  { name: "Raydium", icon: raydiumIcon, vol: "$623M", change: "-1.6%", positive: false },
  { name: "Pump.fun", icon: pumpfunPill, vol: "$127M", change: "+71.49%", positive: true },
];

const green = "#00FF9D";
const red = "#FF4D4D";
const gray = "#CCCCCC";
const dimGray = "#999";
const purple = "#BB86FC";
const cardBg = "#111111";
const borderColor = "#222";

export function MarketLighthouse({
  onRefresh,
  refreshing,
}: {
  onRefresh: (e: React.MouseEvent) => void;
  refreshing: boolean;
}) {
  const { data: launchpadStats } = useLaunchpadStats();
  const [activeTab, setActiveTab] = useState<string>("24h");

  // Derive top launchpads from stats
  const topLaunchpads = (launchpadStats || []).slice(0, 3).map((lp) => {
    const icon = LAUNCHPAD_ICONS[lp.type] || pumpfunPill;
    // Mock volume/change since API only has total count
    const volumes = { pumpfun: "$221M", bonk: "$8.29M", meteora: "$1.25M" };
    const changes = { pumpfun: { val: "-10.9%", pos: false }, bonk: { val: "+100.01%", pos: true }, meteora: { val: "-44.2%", pos: false } };
    const vol = (volumes as any)[lp.type] || `$${(lp.total / 1000).toFixed(1)}K`;
    const ch = (changes as any)[lp.type] || { val: "+0%", pos: true };
    return { name: lp.type, icon, vol, change: ch.val, positive: ch.pos };
  });

  const font = "'Inter', 'SF Pro Display', -apple-system, sans-serif";

  return (
    <div
      style={{
        width: "360px",
        background: "#000000",
        borderRadius: "16px",
        padding: "16px",
        fontFamily: font,
        color: "#fff",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: green, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: "18px", fontWeight: 500, color: "#fff" }}>Market Lighthouse</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {TIME_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "14px",
                fontFamily: font,
                color: activeTab === tab ? "#fff" : "#A0B0FF",
                fontWeight: activeTab === tab ? 600 : 400,
                borderBottom: activeTab === tab ? `1px solid #A0B0FF` : "1px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        {/* Total Trades */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "20px" }}>ℓ</span>
            <span style={{ fontSize: "14px", color: gray }}>Total Trades</span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700 }}>10.5M</span>
          <span style={{ fontSize: "14px", color: green }}>+5.367%</span>
        </div>
        {/* Traders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "20px" }}>♁</span>
            <span style={{ fontSize: "14px", color: gray }}>Traders</span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700 }}>355K</span>
          <span style={{ fontSize: "14px", color: red }}>-8.971%</span>
        </div>
      </div>

      {/* 24h Volume */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "16px", color: "#fff" }}>24h Vol</span>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>$1.78B</span>
          </div>
          <span style={{ fontSize: "14px", color: green }}>+8.60%</span>
        </div>
        {/* Volume bar */}
        <div style={{ position: "relative", display: "flex", height: "20px", borderRadius: "4px", overflow: "hidden", fontSize: "12px" }}>
          <div style={{
            flex: "52.4%",
            background: "linear-gradient(90deg, #00FF9D, #004D2E)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 500,
            fontSize: "11px",
            letterSpacing: "-0.01em",
          }}>
            5.53M / $887M
          </div>
          <div style={{
            flex: "47.6%",
            background: "linear-gradient(90deg, #4D0026, #FF4DB8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 500,
            fontSize: "11px",
          }}>
            5.02M / $893M
          </div>
        </div>
      </div>

      {/* Token Stats */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          <span style={{ fontSize: "16px", fontWeight: 500 }}>Token Stats</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "18px", color: purple }}>◆</span>
              <span style={{ fontSize: "14px", color: gray }}>Created</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>35.7K</span>
            <span style={{ fontSize: "13px", color: green }}>+9.421%</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "18px", color: purple }}>🔗</span>
              <span style={{ fontSize: "14px", color: gray }}>Migrations</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>313</span>
            <span style={{ fontSize: "13px", color: green }}>+25.2%</span>
          </div>
        </div>
      </div>

      {/* Top Launchpads */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 500 }}>Top Launchpads</span>
          <button onClick={onRefresh} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", color: dimGray }}>
            <RefreshCw style={{ width: "14px", height: "14px", transition: "transform 0.6s", transform: refreshing ? "rotate(360deg)" : "none" }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {topLaunchpads.map((lp, i) => (
            <div key={i} style={{
              background: cardBg,
              borderRadius: "8px",
              border: `1px solid #333`,
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}>
              <img src={lp.icon} alt={lp.name} style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover" }} />
              <span style={{ fontSize: "14px", fontWeight: 700 }}>{lp.vol}</span>
              <span style={{ fontSize: "12px", color: lp.positive ? green : red, fontWeight: 500 }}>{lp.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Protocols */}
      <div>
        <span style={{ fontSize: "16px", fontWeight: 500, display: "block", marginBottom: "8px" }}>Top Protocols</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {PROTOCOL_DATA.map((p, i) => (
            <div key={i} style={{
              background: cardBg,
              borderRadius: "8px",
              border: `1px solid #333`,
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}>
              <img src={p.icon} alt={p.name} style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover" }} />
              <span style={{ fontSize: "14px", fontWeight: 700 }}>{p.vol}</span>
              <span style={{ fontSize: "12px", color: p.positive ? green : red, fontWeight: 500 }}>{p.change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
