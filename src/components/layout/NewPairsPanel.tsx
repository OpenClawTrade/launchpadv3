import { useCodexNewPairs, type CodexPairToken } from "@/hooks/useCodexNewPairs";
import { RefreshCw, Rocket, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface NewPairsPanelProps {
  onRefresh?: (e: React.MouseEvent) => void;
  refreshing?: boolean;
  compact?: boolean;
}

function formatMcap(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: false })
      .replace("about ", "")
      .replace("less than a minute", "<1m")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d");
  } catch {
    return "—";
  }
}

export function NewPairsPanel({ onRefresh, refreshing, compact }: NewPairsPanelProps) {
  const { newPairs, isLoading } = useCodexNewPairs();
  const navigate = useNavigate();
  const pairs = newPairs.slice(0, 20);

  const handleClick = (pair: CodexPairToken, e: React.MouseEvent) => {
    e.stopPropagation();
    const mint = pair.address;
    if (mint) {
      navigate(`/launchpad/${mint}`);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: compact ? "calc(100vw - 16px)" : "380px",
        maxWidth: "420px",
        maxHeight: compact ? "70vh" : "460px",
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Rocket style={{ width: "14px", height: "14px", color: "#c8ff00" }} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.95)", fontFamily: "'IBM Plex Mono', monospace" }}>
            New Pairs
          </span>
          <span style={{
            fontSize: "9px",
            fontWeight: 600,
            color: "#c8ff00",
            background: "rgba(200,255,0,0.1)",
            padding: "1px 5px",
            borderRadius: "4px",
          }}>
            LIVE
          </span>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            color: "rgba(255,255,255,0.3)",
          }}>
            <RefreshCw style={{
              width: "12px",
              height: "12px",
              transition: "transform 0.6s",
              transform: refreshing ? "rotate(360deg)" : "none",
            }} />
          </button>
        )}
      </div>

      {/* Table Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 50px",
        padding: "4px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Token</span>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>MCap</span>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Age</span>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.08) transparent",
      }}>
        {isLoading && pairs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
            Loading new pairs…
          </div>
        ) : pairs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
            No new pairs found
          </div>
        ) : (
          pairs.map((pair, idx) => {
            const changeColor = pair.change24h >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
            return (
              <button
                key={pair.address || idx}
                onClick={(e) => handleClick(pair, e)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 50px",
                  width: "100%",
                  padding: "6px 12px",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                  alignItems: "center",
                  gap: "4px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Token info */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                  {pair.imageUrl ? (
                    <img
                      src={pair.imageUrl}
                      alt=""
                      style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "rgba(200,255,0,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      fontWeight: 700,
                      color: "#c8ff00",
                      flexShrink: 0,
                    }}>
                      {pair.symbol?.charAt(0) || "?"}
                    </div>
                  )}
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <div style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      fontFamily: "'IBM Plex Mono', monospace",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      ${pair.symbol}
                    </div>
                    <div style={{
                      fontSize: "9px",
                      color: changeColor,
                      fontWeight: 500,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {pair.change24h >= 0 ? "+" : ""}{pair.change24h.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Market cap */}
                <span style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  textAlign: "right",
                }}>
                  {formatMcap(pair.marketCap)}
                </span>

                {/* Age */}
                <span style={{
                  fontSize: "9px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  textAlign: "right",
                }}>
                  {timeAgo(pair.createdAt)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer link */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/trade"); }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          width: "100%",
          padding: "7px",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(200,255,0,0.04)",
          cursor: "pointer",
          fontSize: "10px",
          fontWeight: 600,
          color: "#c8ff00",
          fontFamily: "'IBM Plex Mono', monospace",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.04)"; }}
      >
        Open Pulse Terminal
        <ExternalLink style={{ width: "10px", height: "10px" }} />
      </button>
    </div>
  );
}
