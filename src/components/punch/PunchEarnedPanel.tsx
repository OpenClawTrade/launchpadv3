import { useState, useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Distribution {
  id: string;
  amount_sol: number;
  creator_wallet: string;
  signature: string | null;
  status: string | null;
  created_at: string | null;
  fun_token_id: string | null;
  token_name?: string;
  token_ticker?: string;
}

export function PunchEarnedPanel() {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);
  const wallet = localStorage.getItem("punch_wallet") || "";

  useEffect(() => {
    fetchDistributions();
  }, []);

  const fetchDistributions = async () => {
    setLoading(true);
    try {
      // First get all punch token IDs (launchpad_type = 'punch')
      const { data: punchTokens } = await supabase
        .from("fun_tokens")
        .select("id, name, ticker")
        .eq("launchpad_type", "punch");

      const punchTokenIds = (punchTokens || []).map(t => t.id);
      const tokenMap: Record<string, { name: string; ticker: string }> = {};
      (punchTokens || []).forEach(t => { tokenMap[t.id] = { name: t.name, ticker: t.ticker }; });

      if (punchTokenIds.length === 0) {
        setDistributions([]);
        setTotalEarned(0);
        setLoading(false);
        return;
      }

      // Only fetch distributions for punch tokens
      const { data, error } = await supabase
        .from("fun_distributions")
        .select("id, amount_sol, creator_wallet, signature, status, created_at, fun_token_id")
        .in("distribution_type", ["punch_creator", "creator", "creator_claim"])
        .in("fun_token_id", punchTokenIds)
        .not("signature", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const enriched = (data || []).map(d => ({
        ...d,
        token_name: d.fun_token_id ? tokenMap[d.fun_token_id]?.name : undefined,
        token_ticker: d.fun_token_id ? tokenMap[d.fun_token_id]?.ticker : undefined,
      }));

      setDistributions(enriched);
      setTotalEarned(enriched.reduce((sum, d) => sum + (d.amount_sol || 0), 0));
    } catch (err) {
      console.error("[PunchEarned] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ padding: 16, color: "#fff" }}>
      <h3 style={{ fontSize: 16, fontWeight: 900, color: "#facc15", marginBottom: 4, textAlign: "center" }}>
        💰 Creator Payouts
      </h3>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 12 }}>
        All fee distributions to creators
      </p>

      {/* Total distributed */}
      <div style={{
        textAlign: "center", padding: "12px 16px", borderRadius: 12, marginBottom: 12,
        background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.12)",
      }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
          Total Distributed
        </p>
        <p style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#facc15" }}>
          {loading ? "..." : `${totalEarned.toFixed(4)} SOL`}
        </p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
          {loading ? "" : `${distributions.length} transactions`}
        </p>
      </div>

      {/* Distributions list */}
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader2 style={{ width: 20, height: 20, color: "#facc15" }} className="animate-spin" />
          </div>
        ) : distributions.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "24px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 28 }}>🐵</span>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
              {wallet ? "No payouts yet for this wallet" : "No distributions found"}
            </p>
          </div>
        ) : (
          distributions.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, marginBottom: 6,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                transition: "background 0.15s",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: "#22c55e",
                  }}>
                    +{d.amount_sol.toFixed(4)} SOL
                  </span>
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 999,
                    background: d.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(250,204,21,0.15)",
                    color: d.status === "completed" ? "#22c55e" : "#facc15",
                    fontWeight: 600,
                  }}>
                    {d.status || "pending"}
                  </span>
                </div>
                {d.token_name && (
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {d.token_name} {d.token_ticker ? `($${d.token_ticker})` : ""}
                  </p>
                )}
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
                  {formatTime(d.created_at)}
                  {d.creator_wallet && (
                    <> · {d.creator_wallet.slice(0, 4)}...{d.creator_wallet.slice(-4)}</>
                  )}
                </p>
              </div>
              {d.signature && (
                <a
                  href={`https://solscan.io/tx/${d.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink style={{ width: 13, height: 13 }} />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
