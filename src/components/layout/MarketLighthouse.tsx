import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMarketLighthouse } from "@/hooks/useMarketLighthouse";
import pumpfunPill from "@/assets/pumpfun-pill.webp";
import bonkIcon from "@/assets/bonk-icon.jpg";
import meteoraIcon from "@/assets/meteora-icon.svg";
import bagsIcon from "@/assets/bags-icon.ico";
import moonshotIcon from "@/assets/moonshot-icon.ico";
import raydiumIcon from "@/assets/raydium-icon.ico";

const LAUNCHPAD_ICONS: Record<string, string> = {
  pumpfun: pumpfunPill,
  pump: pumpfunPill,
  bonk: bonkIcon,
  meteora: meteoraIcon,
  tuna: meteoraIcon,
  dbc: meteoraIcon,
  bags: bagsIcon,
  moonshot: moonshotIcon,
  raydium: raydiumIcon,
};

const PROTOCOL_ICONS: Record<string, string> = {
  "Raydium": raydiumIcon,
  "Orca": meteoraIcon,
  "Jupiter": pumpfunPill,
  "Meteora": meteoraIcon,
  "Pump.fun": pumpfunPill,
  "Phoenix": raydiumIcon,
  "Lifinity": meteoraIcon,
};

const green = "#00FF9D";
const red = "#FF4D4D";
const gray = "#CCCCCC";
const dimGray = "#999";
const purple = "#BB86FC";
const cardBg = "#111111";
const borderColor = "#222";

function formatUsd(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function formatNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

function formatChange(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(val >= 100 || val <= -100 ? 1 : 3)}%`;
}

export function MarketLighthouse({
  onRefresh,
  refreshing,
}: {
  onRefresh: (e: React.MouseEvent) => void;
  refreshing: boolean;
}) {
  const { data, isLoading, refetch } = useMarketLighthouse();

  const font = "'Inter', 'SF Pro Display', -apple-system, sans-serif";

  const handleRefreshAll = (e: React.MouseEvent) => {
    onRefresh(e);
    refetch();
  };

  const totalVol = data?.totalVol24hUsd || 0;
  const volChange = data?.volChange24h || 0;
  const buyVolUsd = data?.buyVolUsd || 0;
  const sellVolUsd = data?.sellVolUsd || 0;
  const buyCount = data?.buyCount || 0;
  const sellCount = data?.sellCount || 0;
  const totalBuySell = buyVolUsd + sellVolUsd;
  const buyPct = totalBuySell > 0 ? (buyVolUsd / totalBuySell) * 100 : 50;

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
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {isLoading && <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", color: dimGray }} />}
          <span style={{ fontSize: "11px", color: dimGray }}>
            {data?.updatedAt ? `${Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000)}m ago` : ""}
          </span>
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
          <span style={{ fontSize: "20px", fontWeight: 700 }}>{formatNum(data?.totalTrades || 0)}</span>
          <span style={{ fontSize: "14px", color: (data?.tradesChange || 0) >= 0 ? green : red }}>
            {formatChange(data?.tradesChange || 0)}
          </span>
        </div>
        {/* Traders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "20px" }}>♁</span>
            <span style={{ fontSize: "14px", color: gray }}>Traders</span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700 }}>{formatNum(data?.uniqueTraders || 0)}</span>
          <span style={{ fontSize: "14px", color: (data?.tradersChange || 0) >= 0 ? green : red }}>
            {formatChange(data?.tradersChange || 0)}
          </span>
        </div>
      </div>

      {/* 24h Volume (Solana-wide from DeFi Llama) */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "16px", color: "#fff" }}>24h Vol</span>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>{formatUsd(totalVol)}</span>
          </div>
          <span style={{ fontSize: "14px", color: volChange >= 0 ? green : red }}>{formatChange(volChange)}</span>
        </div>
        {/* Buy/Sell volume bar (our platform) */}
        {totalBuySell > 0 ? (
          <div style={{ position: "relative", display: "flex", height: "20px", borderRadius: "4px", overflow: "hidden", fontSize: "12px" }}>
            <div style={{
              flex: `${buyPct}%`,
              background: "linear-gradient(90deg, #00FF9D, #004D2E)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 500,
              fontSize: "11px",
            }}>
              {formatNum(buyCount)} / {formatUsd(buyVolUsd)}
            </div>
            <div style={{
              flex: `${100 - buyPct}%`,
              background: "linear-gradient(90deg, #4D0026, #FF4DB8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 500,
              fontSize: "11px",
            }}>
              {formatNum(sellCount)} / {formatUsd(sellVolUsd)}
            </div>
          </div>
        ) : (
          <div style={{ height: "20px", borderRadius: "4px", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "11px", color: dimGray }}>No platform trades yet</span>
          </div>
        )}
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
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatNum(data?.tokensCreated || 0)}</span>
            <span style={{ fontSize: "13px", color: (data?.createdChange || 0) >= 0 ? green : red }}>
              {formatChange(data?.createdChange || 0)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "18px", color: purple }}>🔗</span>
              <span style={{ fontSize: "14px", color: gray }}>Migrations</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 700 }}>{formatNum(data?.migrations || 0)}</span>
            <span style={{ fontSize: "13px", color: (data?.graduatedChange || 0) >= 0 ? green : red }}>
              {formatChange(data?.graduatedChange || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Top Launchpads (our platform) */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 500 }}>Top Launchpads</span>
          <button onClick={handleRefreshAll} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", color: dimGray }}>
            <RefreshCw style={{ width: "14px", height: "14px", transition: "transform 0.6s", transform: refreshing ? "rotate(360deg)" : "none" }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {(data?.topLaunchpads || []).length > 0 ? (
            data!.topLaunchpads.map((lp, i) => {
              const icon = LAUNCHPAD_ICONS[lp.type] || pumpfunPill;
              return (
                <div key={i} style={{
                  background: cardBg,
                  borderRadius: "8px",
                  border: "1px solid #333",
                  padding: "10px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}>
                  <img src={icon} alt={lp.type} style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover" }} />
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>{formatUsd(lp.vol24hUsd)}</span>
                  <span style={{ fontSize: "11px", color: dimGray }}>{lp.type}</span>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: "12px", color: dimGray, padding: "8px" }}>
              {isLoading ? "Loading..." : "No data"}
            </div>
          )}
        </div>
      </div>

      {/* Top Protocols (Solana-wide from DeFi Llama) */}
      <div>
        <span style={{ fontSize: "16px", fontWeight: 500, display: "block", marginBottom: "8px" }}>Top Protocols</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {(data?.topProtocols || []).length > 0 ? (
            data!.topProtocols.map((p, i) => {
              const icon = PROTOCOL_ICONS[p.name] || raydiumIcon;
              return (
                <div key={i} style={{
                  background: cardBg,
                  borderRadius: "8px",
                  border: "1px solid #333",
                  padding: "10px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}>
                  <img src={icon} alt={p.name} style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "cover" }} />
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>{formatUsd(p.vol24hUsd)}</span>
                  <span style={{ fontSize: "12px", color: p.change >= 0 ? green : red, fontWeight: 500 }}>{formatChange(p.change)}</span>
                  <span style={{ fontSize: "10px", color: dimGray }}>{p.name}</span>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: "12px", color: dimGray, padding: "8px" }}>
              {isLoading ? "Loading..." : "No data"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
