import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Sticky Footer Menu (sfm) — always pinned to bottom of viewport.
 * Mirrors the standalone `sticky-footer.html` reference 1:1.
 */

interface Ticker {
  sym: "BTC" | "ETH" | "BNB";
  price: string;
  chg: string;
  up: boolean;
  cx: string;
}

const DEFAULT_TICKERS: Ticker[] = [
  { sym: "BTC", price: "$75,655", chg: "+0.0%", up: true,  cx: "#f7931a" },
  { sym: "ETH", price: "$2,312",  chg: "+0.1%", up: true,  cx: "#627eea" },
  { sym: "BNB", price: "$628.57", chg: "+0.0%", up: true,  cx: "#f0b90b" },
];

export function Footer() {
  const [tickers] = useState<Ticker[]>(DEFAULT_TICKERS);
  const [stable, setStable] = useState(true);
  const [latencyMs] = useState(50);

  // Reserve viewport space so page content is never hidden behind the bar
  useEffect(() => {
    const orig = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "44px";
    return () => { document.body.style.paddingBottom = orig; };
  }, []);

  const pings = useMemo(() => `Eth-E ${latencyMs}ms`, [latencyMs]);

  return (
    <div className="sfm">
      <div className="sfm-inner">
        <Link to="/launchpad" className="sfm-pill">🚀 Launch</Link>
        <Link to="/" className="sfm-pill">⚡ Pulse</Link>
        <Link to="/tokens" className="sfm-pill">+ New Pairs</Link>

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
  );
}
