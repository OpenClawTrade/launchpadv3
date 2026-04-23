import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import { NewPairsPanel } from "./NewPairsPanel";

/**
 * Sticky Footer Menu (sfm) — always pinned to bottom of viewport.
 * Realtime BTC/ETH/BNB tickers + Tracker / New Pairs popovers (Ethereum).
 */

interface Ticker {
  sym: "BTC" | "ETH" | "BNB";
  price: string;
  chg: string;
  up: boolean;
  cx: string;
}

const COLORS: Record<Ticker["sym"], string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  BNB: "#f0b90b",
};

const DEFAULT_TICKERS: Ticker[] = [
  { sym: "BTC", price: "—", chg: "—", up: true, cx: COLORS.BTC },
  { sym: "ETH", price: "—", chg: "—", up: true, cx: COLORS.ETH },
  { sym: "BNB", price: "—", chg: "—", up: true, cx: COLORS.BNB },
];

function fmtPrice(p: number): string {
  if (!isFinite(p) || p <= 0) return "—";
  if (p >= 1000) return "$" + p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return "$" + p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return "$" + p.toFixed(4);
}

function fmtChg(c: number): string {
  if (!isFinite(c)) return "—";
  const sign = c >= 0 ? "+" : "";
  return `${sign}${c.toFixed(2)}%`;
}

export function Footer() {
  const [tickers, setTickers] = useState<Ticker[]>(DEFAULT_TICKERS);
  const [stable, setStable] = useState(true);
  const [latencyMs, setLatencyMs] = useState(50);
  const [newPairsOpen, setNewPairsOpen] = useState(false);
  const newPairsRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { authenticated, login } = usePrivy();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke("crypto-prices");
        if (cancelled) return;
        if (error || !data) {
          setStable(false);
          return;
        }
        setLatencyMs(Date.now() - start);
        setStable(true);
        const next: Ticker[] = (["BTC", "ETH", "BNB"] as const).map((sym) => {
          const k = sym.toLowerCase() as "btc" | "eth" | "bnb";
          const row = (data as any)[k] ?? { price: 0, change24h: 0 };
          const chg = Number(row.change24h) || 0;
          return {
            sym,
            price: fmtPrice(Number(row.price) || 0),
            chg: fmtChg(chg),
            up: chg >= 0,
            cx: COLORS[sym],
          };
        });
        setTickers(next);
      } catch {
        if (!cancelled) setStable(false);
      }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const orig = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "44px";
    return () => { document.body.style.paddingBottom = orig; };
  }, []);

  useEffect(() => {
    if (!newPairsOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (newPairsRef.current && !newPairsRef.current.contains(t)) setNewPairsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [newPairsOpen]);

  const pings = useMemo(() => `Eth-E ${latencyMs}ms`, [latencyMs]);

  const noop = (_e: React.MouseEvent) => {};

  const handleTracker = () => {
    setNewPairsOpen(false);
    if (authenticated) {
      navigate("/tracker");
    } else {
      login();
    }
  };

  return (
    <>
      {newPairsOpen && (
        <div
          ref={newPairsRef}
          style={{
            position: "fixed",
            left: 8,
            bottom: 52,
            zIndex: 100000,
            maxWidth: "calc(100vw - 16px)",
          }}
        >
          <NewPairsPanel onRefresh={noop} refreshing={false} defaultChain="ethereum" />
        </div>
      )}
      <div className="sfm">
        <div className="sfm-inner">
          <button className="sfm-pill" onClick={handleTracker}>
            Tracker
          </button>

          <button
            className={`sfm-pill ${newPairsOpen ? "on" : ""}`}
            onClick={() => { setNewPairsOpen(v => !v); }}
          >
            + New Pairs
          </button>

          <Link to="/launch" className="sfm-pill">🚀 Launch</Link>

          <span className="sfm-divider" />

          {tickers.map(t => (
            <span key={t.sym} className="sfm-tick">
              <span className="cx" style={{ background: t.cx }} />
              <span className="sym">{t.sym}</span>
              <span className="px">{t.price}</span>
              <span className={`chg ${t.up ? "up" : "dn"}`}>{t.chg}</span>
            </span>
          ))}

          <span className="sfm-spacer" />

          <button className={`sfm-pill ${stable ? "on" : ""}`} onClick={() => setStable(s => !s)}>
            {stable ? "Stable" : "Reconnect"}
          </button>
          <span className="sfm-ping"><span className="dot" />{pings}</span>
        </div>
      </div>
    </>
  );
}
