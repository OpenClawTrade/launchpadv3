// Popshiba Docs page — styled to match the /launch.html landing aesthetic.
// Pure inline styles + a tiny <style> block so it stays visually independent
// from the rest of the app's theme tokens.
import { useEffect } from "react";

const PRIMARY = "#f5a524";
const PRIMARY_2 = "#e8891a";
const CREAM = "#f4e9d2";
const INK = "#0e0b08";
const INK_3 = "#1a1611";
const BROWN = "#6b5842";
const MUTED = "#8a7860";
const LIME = "#d3ff3a";

const X_URL = "https://x.com/PopShiba_launch";

export default function PopshibaDocsPage() {
  useEffect(() => {
    document.title = "Popshiba — Docs";
    const prev = document.body.style.background;
    document.body.style.background = PRIMARY;
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  return (
    <div style={{ background: PRIMARY, minHeight: "100vh", color: INK }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .pdoc, .pdoc * { box-sizing: border-box; }
        .pdoc { font-family: 'JetBrains Mono', ui-monospace, monospace; color: ${INK}; }
        .pdoc h1, .pdoc h2, .pdoc h3, .pdoc .display { font-family: 'Archivo Black', system-ui, sans-serif; letter-spacing:-0.01em; line-height:1.02; }
        .pdoc a { color: inherit; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
        .pdoc .chip { display:inline-block; font-size:10px; letter-spacing:0.14em; background:${INK}; color:${PRIMARY}; padding:5px 10px; text-transform:uppercase; font-weight:700; }
        .pdoc .card { background:${CREAM}; border:3px solid ${INK}; box-shadow: 8px 8px 0 ${INK}; padding: 28px 28px 24px; }
        .pdoc .card.dark { background:${INK}; color:${CREAM}; box-shadow: 8px 8px 0 ${CREAM}; border-color:${INK}; }
        .pdoc .grid2 { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 22px; }
        .pdoc .grid3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; }
        .pdoc .grid4 { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        @media (max-width: 900px) { .pdoc .grid2, .pdoc .grid3, .pdoc .grid4 { grid-template-columns: 1fr; } }
        .pdoc .stat .k { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; color:${MUTED}; text-transform:uppercase; margin-bottom:6px; }
        .pdoc .stat .v { font-family:'Archivo Black',sans-serif; font-size:22px; color:${INK}; }
        .pdoc .row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 14px; border:2px solid ${INK}; background:#fff; }
        .pdoc .row + .row { margin-top:8px; }
        .pdoc .step { display:flex; gap:14px; align-items:flex-start; padding:14px; border:2px solid ${INK}; background:#fff; }
        .pdoc .step .num { font-family:'Archivo Black',sans-serif; font-size:24px; color:${INK}; background:${PRIMARY}; border:2px solid ${INK}; box-shadow:3px 3px 0 ${INK}; padding: 4px 12px; min-width:54px; text-align:center; }
        .pdoc .step .body .t { font-family:'Archivo Black',sans-serif; font-size:15px; margin-bottom:4px; }
        .pdoc .step .body .s { font-size:12px; line-height:1.55; color:${BROWN}; }
        .pdoc .toc a { display:block; padding:10px 12px; border:2px solid ${INK}; background:#fff; text-decoration:none; font-size:12px; letter-spacing:0.04em; }
        .pdoc .toc a:hover { background:${PRIMARY}; }
        .pdoc .pill { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border:2px solid ${INK}; background:${PRIMARY}; font-family:'Archivo Black',sans-serif; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; box-shadow:3px 3px 0 ${INK}; }
        .pdoc .btn { display:inline-flex; align-items:center; gap:8px; padding:11px 18px; border:2px solid ${INK}; background:${PRIMARY}; color:${INK}; font-family:'Archivo Black',sans-serif; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; box-shadow:4px 4px 0 ${INK}; text-decoration:none; cursor:pointer; }
        .pdoc .btn.dark { background:${INK}; color:${PRIMARY}; box-shadow:4px 4px 0 ${PRIMARY}; }
        .pdoc hr.dashed { border:0; border-top: 2px dashed ${INK}; margin: 18px 0; opacity:0.35; }
        .pdoc table.tax { width:100%; border-collapse: collapse; font-family:'JetBrains Mono',monospace; font-size:13px; }
        .pdoc table.tax th, .pdoc table.tax td { border:2px solid ${INK}; padding:10px 12px; text-align:left; }
        .pdoc table.tax th { background:${INK}; color:${PRIMARY}; font-family:'Archivo Black',sans-serif; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; }
        .pdoc table.tax tr:nth-child(even) td { background:#fff; }
        .pdoc table.tax tr:nth-child(odd) td { background:${CREAM}; }
      `}</style>

      <div className="pdoc" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 22px 80px" }}>
        {/* Top nav strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, gap: 14, flexWrap: "wrap" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 38, height: 38, background: INK, color: PRIMARY, display: "grid", placeItems: "center", border: `2px solid ${INK}`, boxShadow: `3px 3px 0 ${INK}`, fontFamily: "'Archivo Black',sans-serif" }}>P</div>
            <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 18, color: INK }}>POPSHIBA</span>
            <span className="chip">DOCS</span>
          </a>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn dark" href="/">← BACK TO LAUNCHPAD</a>
            <a className="btn" href={X_URL} target="_blank" rel="noopener noreferrer">FOLLOW @POPSHIBA</a>
          </div>
        </div>

        {/* HERO */}
        <div className="card" style={{ padding: "42px 32px 36px", marginBottom: 26 }}>
          <div className="chip" style={{ marginBottom: 14 }}>POPSHIBA · ETHEREUM LAUNCHPAD</div>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 64px)", margin: "0 0 14px" }}>
            Launch a coin in <span style={{ color: PRIMARY_2 }}>1 transaction.</span><br />Trade it on Uniswap <span style={{ color: PRIMARY_2 }}>60 seconds later.</span>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: BROWN, maxWidth: 760, margin: 0 }}>
            Popshiba is a fair-launch ERC-20 launchpad on Ethereum. No bonding-curve waiting room, no team-controlled keys — every coin spawns its own Uniswap V3 pool, the LP is locked from day one, and the creator earns <b style={{ color: INK }}>50% of every swap fee</b>.
          </p>
          <div className="grid4" style={{ marginTop: 26 }}>
            <div className="stat"><div className="k">Chain</div><div className="v">Ethereum</div></div>
            <div className="stat"><div className="k">DEX</div><div className="v">Uniswap V3</div></div>
            <div className="stat"><div className="k">Graduation</div><div className="v">$100K MC</div></div>
            <div className="stat"><div className="k">Creator share</div><div className="v">50% of fees</div></div>
          </div>
        </div>

        {/* TOC */}
        <div className="card" style={{ marginBottom: 26 }}>
          <div className="chip" style={{ marginBottom: 12 }}>JUMP TO</div>
          <div className="toc grid4">
            <a href="#what">01 · What is Popshiba</a>
            <a href="#how">02 · How a launch works</a>
            <a href="#fees">03 · Fees & creator earnings</a>
            <a href="#holders">04 · Holders rewards</a>
          </div>
        </div>

        {/* 01 — WHAT IS POPSHIBA */}
        <section id="what" className="card" style={{ marginBottom: 26 }}>
          <div className="chip" style={{ marginBottom: 10 }}>01 · WHAT IS POPSHIBA</div>
          <h2 style={{ fontSize: 32, margin: "0 0 14px" }}>The fair-launch playground for <span style={{ color: PRIMARY_2 }}>Ethereum-native</span> meme coins.</h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: BROWN, marginTop: 0 }}>
            Popshiba was built on a single belief: <b style={{ color: INK }}>launching a coin should be as easy as posting a tweet</b>, and as safe as buying off a real DEX. We took the best parts of every launchpad that came before — the speed of pump.fun, the on-chain transparency of Uniswap, the LP-burn protection of klik.finance — and wrapped them in a cream-and-orange terminal that anyone can use.
          </p>
          <hr className="dashed" />
          <div className="grid3">
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🪙 Permissionless</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>Connect a wallet, fill 4 fields, deploy. No allowlist, no KYC, no waitlist.</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🔒 Locked from second 0</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>The Uniswap V3 LP NFT is sent to a locker (or burned) inside the same transaction that creates the pool.</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>💸 Creator-first economics</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>50% of every swap fee streams back to the deployer wallet — claimable from your Earnings page.</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🚫 No pre-mine, no team bag</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>The full token supply goes into the LP. The deployer can optionally buy first in the same tx, but never mints to themselves.</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🧠 Smart routing</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>Trades route through the cheapest Uniswap V3 fee tier, with built-in MEV protection on the buy side.</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🪐 Native to ETH culture</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>Built only for Ethereum mainnet. No bridges, no L2 fragmentation, no &quot;coming soon to chain X.&quot;</div>
            </div>
          </div>
        </section>

        {/* 02 — HOW A LAUNCH WORKS */}
        <section id="how" className="card" style={{ marginBottom: 26 }}>
          <div className="chip" style={{ marginBottom: 10 }}>02 · HOW A LAUNCH WORKS</div>
          <h2 style={{ fontSize: 32, margin: "0 0 8px" }}>Six fields. One transaction. <span style={{ color: PRIMARY_2 }}>~60 seconds.</span></h2>
          <p style={{ fontSize: 13, color: BROWN, marginTop: 0, marginBottom: 18 }}>The whole flow happens in a single batched tx — pool creation, liquidity seed, LP lock, optional dev-buy, and trading enable, all atomic.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="step"><div className="num">01</div><div className="body"><div className="t">Connect your wallet</div><div className="s">Privy embedded wallet works out of the box. MetaMask, Rabby, WalletConnect supported.</div></div></div>
            <div className="step"><div className="num">02</div><div className="body"><div className="t">Fill the identity card</div><div className="s">Coin name, ticker, description, image, plus optional X / website / Telegram links.</div></div></div>
            <div className="step"><div className="num">03</div><div className="body"><div className="t">Pick your LP seed</div><div className="s">Presets: 0.5 / 1 / 3 / 5 ETH. Bigger LP = lower slippage and a higher starting market cap.</div></div></div>
            <div className="step"><div className="num">04</div><div className="body"><div className="t">Set your trading tax (optional)</div><div className="s">0%–3% creator tax. Popshiba always adds a fixed 1% on top — total swap tax is capped at 4%.</div></div></div>
            <div className="step"><div className="num">05</div><div className="body"><div className="t">Optional dev first-buy</div><div className="s">Pre-fund a buy in the same tx so snipers can&apos;t front-run you. Default $50, configurable.</div></div></div>
            <div className="step"><div className="num">06</div><div className="body"><div className="t">Sign &amp; deploy</div><div className="s">Contract deploys, V3 pool opens, LP is seeded and locked, dev-buy executes, trading goes live.</div></div></div>
          </div>

          <hr className="dashed" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="grid2">
            <div className="card dark" style={{ boxShadow: `6px 6px 0 ${PRIMARY}` }}>
              <div className="chip" style={{ background: PRIMARY, color: INK, marginBottom: 10 }}>LP LOCKER</div>
              <h3 style={{ fontSize: 20, margin: "0 0 8px", color: CREAM }}>What &quot;LP locker&quot; really means</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#cdbfa5", margin: 0 }}>
                Selecting an LP locker amount <b style={{ color: PRIMARY }}>does not</b> mean you pay extra to a third party. It means that amount of ETH is added <b style={{ color: PRIMARY }}>directly to the Uniswap V3 pool</b> and the resulting LP NFT is sent to the locker contract. More locked LP = deeper liquidity = a healthier chart from second 0.
              </p>
            </div>
            <div className="card dark" style={{ boxShadow: `6px 6px 0 ${PRIMARY}` }}>
              <div className="chip" style={{ background: PRIMARY, color: INK, marginBottom: 10 }}>GRADUATION</div>
              <h3 style={{ fontSize: 20, margin: "0 0 8px", color: CREAM }}>Graduates at $100K market cap</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#cdbfa5", margin: 0 }}>
                Once a Popshiba coin clears <b style={{ color: PRIMARY }}>$100K market cap</b>, it&apos;s flagged as <em>graduated</em> across the platform: featured on Pulse, picked up by the X-tracker, surfaced to alpha feeds and CEX scouts.
              </p>
            </div>
          </div>
        </section>

        {/* 03 — FEES & EARNINGS */}
        <section id="fees" className="card" style={{ marginBottom: 26 }}>
          <div className="chip" style={{ marginBottom: 10 }}>03 · FEES &amp; CREATOR EARNINGS</div>
          <h2 style={{ fontSize: 32, margin: "0 0 14px" }}>You set the tax. <span style={{ color: PRIMARY_2 }}>You keep half.</span></h2>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: BROWN, margin: "0 0 18px" }}>
            Every swap on a Popshiba token is taxed. The creator picks how aggressive (0% to 3%) and Popshiba always adds a flat 1% on top. <b style={{ color: INK }}>50% of the total fee stream goes back to the creator wallet</b>, claimable any time from the Earnings page.
          </p>

          <table className="tax">
            <thead>
              <tr>
                <th>Creator tax</th>
                <th>Popshiba fee</th>
                <th>Total swap tax</th>
                <th>Your share (50%)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>0%</td><td>1%</td><td><b>1%</b> (minimum)</td><td>0.5%</td></tr>
              <tr><td>0.5%</td><td>1%</td><td><b>1.5%</b></td><td>0.75%</td></tr>
              <tr><td>1%</td><td>1%</td><td><b>2%</b></td><td>1%</td></tr>
              <tr><td>2%</td><td>1%</td><td><b>3%</b></td><td>1.5%</td></tr>
              <tr><td>3% (max)</td><td>1%</td><td><b>4%</b> (maximum)</td><td>2%</td></tr>
            </tbody>
          </table>

          <hr className="dashed" />

          <div className="grid2">
            <div className="row" style={{ display: "block" }}>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>📈 Fees stream live</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>Swap fees accrue in the Uniswap V3 position the moment trading goes live. No waiting for a graduation event to start earning.</div>
            </div>
            <div className="row" style={{ display: "block" }}>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>💰 Claim any time</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>Head to your Earnings page, sign one tx, and the accumulated ETH lands in your wallet. No vesting, no lockup.</div>
            </div>
            <div className="row" style={{ display: "block" }}>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🛡️ Hard-coded cap</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>The contract refuses to set a creator tax above 3%. Total swap tax can <b>never</b> exceed 4%. Period.</div>
            </div>
            <div className="row" style={{ display: "block" }}>
              <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 14, marginBottom: 6 }}>🪙 Paid in ETH</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: BROWN }}>All earnings are denominated in ETH (the pool&apos;s quote asset), so creator income tracks the asset everyone wants to be paid in.</div>
            </div>
          </div>
        </section>

        {/* 04 — HOLDERS REWARDS */}
        <section id="holders" className="card dark" style={{ marginBottom: 26 }}>
          <div className="chip" style={{ background: PRIMARY, color: INK, marginBottom: 10 }}>04 · HOLDERS REWARDS</div>
          <h2 style={{ fontSize: 32, margin: "0 0 12px", color: CREAM }}>
            Holders rewards from platform fees — <span style={{ color: LIME }}>revealed soon.</span>
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#cdbfa5", margin: "0 0 18px", maxWidth: 720 }}>
            A share of the <b style={{ color: PRIMARY }}>1% Popshiba platform fee</b> earned across every launch will be redistributed to holders of select Popshiba ecosystem tokens. The exact mechanics, eligibility tiers and distribution cadence will be revealed in the upcoming days.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "#cdbfa5", margin: "0 0 22px", maxWidth: 720 }}>
            <b style={{ color: PRIMARY }}>Follow our X for news</b> — every drop, every snapshot, every claim window will be announced there first.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn" href={X_URL} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.26L4.86 22H2.1l6.97-7.96L2 2h6.91l4.32 5.71L18.24 2zm-2.38 18h1.74L7.22 4H5.4l10.46 16z" />
              </svg>
              FOLLOW ON X
            </a>
            <a className="btn dark" href="/" style={{ boxShadow: `4px 4px 0 ${PRIMARY}` }}>← BACK TO LAUNCHPAD</a>
          </div>
        </section>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.1em", color: INK, opacity: 0.7, fontFamily: "'JetBrains Mono',monospace" }}>
          POPSHIBA · ETHEREUM LAUNCHPAD · DOCS v1
        </div>
      </div>
    </div>
  );
}
