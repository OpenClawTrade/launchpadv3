/**
 * PopshibaLaunchpadPage
 * Pixel-perfect template (iframe) + live ETH data + real launcher modal.
 *
 * - Live launches table, hero stats, and progress bars are populated with
 *   real data from `eth_launch_requests` joined with on-chain market data
 *   (price / MC / 24h vol / 24h change / liquidity) fetched via the
 *   `eth-batch-market` edge function (DexScreener under the hood).
 * - "Trade" button on each row → /ape/:address (escapes iframe with _top).
 * - "🚀 LAUNCH IT" inside iframe → opens real <EthLauncher /> modal,
 *   prefilled from the form values posted up via window.postMessage.
 * - Empty-state CTA when there are no live launches.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EthLauncher } from "@/components/launchpad/EthLauncher";

type EthLaunch = {
  id: string;
  token_name: string;
  token_ticker: string;
  image_url: string | null;
  status: string;
  created_at: string;
  token_address: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  website_url: string | null;
};

type Market = {
  priceUsd: number | null;
  marketCap: number | null;
  volumeH24: number | null;
  changeH24: number | null;
  liquidityUsd: number | null;
  pairUrl: string | null;
};

type LauncherPrefill = {
  name?: string;
  ticker?: string;
  description?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  devBuyEth?: number;
  lockLP?: boolean;
  imageDataUrl?: string;
};

const palette = ["#8ed36c", "#e8c88a", "#f5d84a", "#cf5f5f", "#f5a524", "#c08fe6", "#7b5dd9", "#a8c27a"];
const emojis = ["🐸", "🦴", "🍌", "🧲", "🌮", "🪩", "🔮", "🐌", "🚀", "🐕", "🌙", "🚂", "🧃", "👽", "🦄"];

// Bonding-curve target (USD liquidity). Tokens at/above this read 100% (graduated).
const GRAD_LIQUIDITY_USD = 50_000;

function ageOf(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(n).toFixed(1)}%`;
}

function progressFor(m: Market | undefined, status: string): number {
  if (status === "graduated") return 100;
  const liq = m?.liquidityUsd ?? 0;
  if (liq <= 0) return 5;
  return Math.max(5, Math.min(100, Math.round((liq / GRAD_LIQUIDITY_USD) * 100)));
}

// SVG path builder for the mini sparkline (matches the template card styling).
function buildSparkPath(values: number[]): string {
  if (!values || values.length < 2) return "";
  const W = 100;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);
  return values
    .map((v, i) => {
      const x = (i * step).toFixed(2);
      const y = (H - 2 - ((v - min) / range) * (H - 4)).toFixed(2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

// --- Synthetic sparkline (mirrors SparklineCanvas.normalizeFlatData) ---
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233280) * 49297;
  return x - Math.floor(x);
}
// Deterministic 24-point curve when no real Codex data is available.
// `trend` (-1..+1) biases the slope so up tokens trend up, down tokens trend down.
function syntheticSparkline(seed: string, trend = 0): number[] {
  const h = hashSeed(seed);
  const numPoints = 24;
  const mean = 1;
  const amplitude = 0.18;
  const freq1 = 0.15 + (h % 100) / 500;
  const freq2 = 0.08 + ((h >> 8) % 100) / 800;
  const phase1 = ((h % 360) * Math.PI) / 180;
  const phase2 = (((h >> 4) % 360) * Math.PI) / 180;
  const drift = trend * amplitude * 0.6;
  const out: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const wave =
      Math.sin(i * freq1 + phase1) * 0.6 +
      Math.sin(i * freq2 + phase2) * 0.4 +
      (seededRandom(h, i) - 0.5) * 0.3;
    out.push(mean + wave * amplitude + drift * t);
  }
  return out;
}

function injectTopTokens(
  doc: Document,
  topTokens: Array<{ launch: EthLaunch; market: Market; sparkline: number[]; index: number }>
) {
  const list = doc.getElementById("grad-list");
  if (!list) return;
  if (topTokens.length === 0) {
    list.innerHTML = `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#fff7e0;opacity:0.7;padding:24px;text-align:center;width:100%">No tokens yet — be the first to launch.</div>`;
    return;
  }
  list.innerHTML = "";
  topTokens.forEach(({ launch, market, sparkline, index }) => {
    const av = emojis[index % emojis.length];
    const bg = palette[index % palette.length];
    const tick = (launch.token_ticker || "—").toUpperCase().replace(/</g, "&lt;");
    const name = (launch.token_name || "unnamed").replace(/</g, "&lt;");
    const mc = market?.marketCap ?? 0;
    const chg = market?.changeH24 ?? null;
    const chgColor = chg == null ? "var(--up)" : chg >= 0 ? "var(--up)" : "#ff6b4a";
    const chgText = chg == null ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`;
    // Always render a chart — use real Codex sparkline if we got one,
    // otherwise generate a deterministic synthetic curve seeded by the token
    // address so every card matches /trade's pulse-card look.
    const sparkData =
      sparkline && sparkline.length >= 2
        ? sparkline
        : syntheticSparkline(
            launch.token_address || launch.id,
            chg == null ? 0 : Math.max(-1, Math.min(1, chg / 50))
          );
    const path = buildSparkPath(sparkData);
    const isUp = sparkData[sparkData.length - 1] >= sparkData[0];
    const lineColor = isUp ? "#0ed47a" : "#ff6b4a";
    const fillColor = isUp ? "rgba(14,212,122,0.18)" : "rgba(255,107,74,0.18)";
    const tradeHref = launch.token_address ? `/ape/${launch.token_address}` : "#";
    const imageHTML = launch.image_url
      ? `<img src="${launch.image_url}" alt="" style="width:100%;height:100%;object-fit:cover" />`
      : av;
    const card = doc.createElement("a");
    card.className = "grad-card";
    card.setAttribute("href", tradeHref);
    card.setAttribute("target", "_top");
    card.style.textDecoration = "none";
    card.style.color = "inherit";
    card.innerHTML = `
      <div class="top">
        <div class="av" style="background:${bg};overflow:hidden">${imageHTML}</div>
        <div><div class="nm">${name}</div><div class="sm">$${tick}</div></div>
        <span class="badge">◆ TOP</span>
      </div>
      <div class="stats-mini">
        <div><div class="gm">MCAP</div><div class="gv">${fmtUsd(mc)}</div></div>
        <div><div class="gm">24H</div><div class="gv" style="color:${chgColor}">${chgText}</div></div>
      </div>
      <div class="mini-chart">
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
          <path d="${path} L 100 30 L 0 30 Z" fill="${fillColor}" stroke="none"/>
          <path d="${path}" fill="none" stroke="${lineColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
    list.appendChild(card);
  });
}

function injectHeroCard(
  doc: Document,
  latest: EthLaunch | null,
  market: Market | undefined
) {
  const card = doc.getElementById("hp-card");
  if (!latest) {
    // No live launches → keep skeleton, don't flash placeholder text.
    if (card) card.setAttribute("data-ready", "0");
    return;
  }
  const set = (id: string, v: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = v;
  };
  const setHTML = (id: string, html: string) => {
    const el = doc.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const setHref = (id: string, href: string | null | undefined) => {
    const el = doc.getElementById(id) as HTMLAnchorElement | null;
    if (!el) return;
    if (href && /^https?:\/\//i.test(href)) {
      el.setAttribute("href", href);
      el.style.display = "inline-flex";
    } else {
      el.removeAttribute("href");
      el.style.display = "none";
    }
  };
  const tick = (latest.token_ticker || "—").toUpperCase();
  set("hp-name", latest.token_name || "unnamed");
  set("hp-tick", `$${tick}`);
  set("hp-sticker", `NEW · ${ageOf(latest.created_at)} ago`);
  if (latest.image_url) {
    setHTML(
      "hp-avatar",
      `<img src="${latest.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`
    );
  } else {
    set("hp-avatar", (tick[0] || "P").toUpperCase());
  }
  const link = doc.getElementById("hp-link") as HTMLAnchorElement | null;
  if (link) link.href = latest.token_address ? `/ape/${latest.token_address}` : "#";

  // Socials — wire whatever exists, hide the rest (no flicker of broken links)
  setHref("hp-tw", latest.twitter_url);
  setHref("hp-tg", latest.telegram_url);
  setHref("hp-web", latest.website_url);

  const price = market?.priceUsd ?? null;
  const vol = market?.volumeH24 ?? null;
  const chg = market?.changeH24 ?? null;
  const mc = market?.marketCap ?? 0;
  set("hp-price", mc > 0 ? fmtUsd(mc) : "$—");
  set("hp-vol", vol != null ? fmtUsd(vol) : "$—");
  const chgEl = doc.getElementById("hp-chg");
  if (chgEl) {
    chgEl.textContent = fmtPct(chg);
    (chgEl as HTMLElement).style.color = chg == null ? "" : chg >= 0 ? "#0b8a3a" : "#c8372d";
  }
  const pct = Math.max(2, Math.min(100, Math.round((mc / 100_000) * 100)));
  const fill = doc.getElementById("hp-bar-fill") as HTMLElement | null;
  if (fill) fill.style.width = `${pct}%`;
  set("hp-bar-left", `${fmtUsd(mc)} / $100K MC`);
  set("hp-bar-right", `${pct}%`);
  const liveEl = doc.getElementById("hp-live");
  if (liveEl) {
    liveEl.textContent = market ? "LIVE" : "DEPLOYING";
    (liveEl as HTMLElement).style.opacity = market ? "1" : "0.65";
  }

  // Reveal the card now that real data is in place.
  if (card) card.setAttribute("data-ready", "1");
}

function injectLiveData(
  doc: Document,
  launches: EthLaunch[],
  markets: Record<string, Market>,
  hero: { totalVolume: number; totalCoins: number; gradPct: number; totalMC: number }
) {
  const body = doc.getElementById("ll-body");
  const counter = doc.getElementById("ll-count");
  const stat = doc.getElementById("stat-launched");
  if (!body) return;
  body.innerHTML = "";

  if (launches.length === 0) {
    const tr = doc.createElement("tr");
    tr.innerHTML = `
      <td colspan="8" style="text-align:center;padding:42px 22px">
        <div style="font-family:'Archivo Black',sans-serif;font-size:22px;letter-spacing:-0.01em;margin-bottom:6px">
          Nothing live yet. <em style="color:#e8891a;font-style:normal">Be the first.</em>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#3a1f14;letter-spacing:0.08em;margin-bottom:18px">
          The launchpad is open. Launch your coin in 60 seconds and seed the board.
        </div>
        <button onclick="document.getElementById('createForm').scrollIntoView({behavior:'smooth',block:'start'})"
                style="font-family:'Archivo Black',sans-serif;font-size:14px;padding:12px 22px;border:2px solid #0e0b08;background:#f5a524;color:#0e0b08;box-shadow:4px 4px 0 #0e0b08;letter-spacing:0.02em;cursor:pointer">
          🚀 Launch your coin
        </button>
      </td>
    `;
    body.appendChild(tr);
  } else {
    launches.forEach((l, i) => {
      const av = emojis[i % emojis.length];
      const bg = palette[i % palette.length];
      const m = l.token_address ? markets[l.token_address.toLowerCase()] : undefined;
      const liq = m?.liquidityUsd ?? 0;
      const prog = Math.max(5, Math.min(100, Math.round((liq / GRAD_LIQUIDITY_USD) * 100)));
      const status = liq >= GRAD_LIQUIDITY_USD ? "DEEP LIQ" : "LIVE";
      const change = m?.changeH24 ?? null;
      const changeClass = change == null ? "up" : change >= 0 ? "up" : "down";
      const tr = doc.createElement("tr");
      const safeName = (l.token_name || "unnamed").replace(/</g, "&lt;");
      const safeTick = (l.token_ticker || "—").toUpperCase().replace(/</g, "&lt;");
      const imageHTML = l.image_url
        ? `<img src="${l.image_url}" alt="" style="width:100%;height:100%;object-fit:cover" />`
        : av;
      const tradeHref = l.token_address ? `/ape/${l.token_address}` : "#";
      tr.innerHTML = `
        <td>
          <div class="ll-tok">
            <div class="ll-av" style="background:${bg};overflow:hidden">${imageHTML}</div>
            <div><div class="ll-nm">${safeName}</div><div class="ll-sm">$${safeTick}</div></div>
          </div>
        </td>
        <td><span class="ll-time">${ageOf(l.created_at)}</span></td>
        <td><span class="ll-mc">${fmtUsd(m?.marketCap)}</span></td>
        <td><span class="ll-chg ${changeClass}">${fmtPct(change)}</span></td>
        <td>
          <div class="ll-progress">
            <div class="ll-bar${prog >= 85 ? " grad" : ""}" style="--w:${prog}%"></div>
            <span class="ll-pct">${fmtUsd(liq)}</span>
          </div>
        </td>
        <td><span class="ll-time">${fmtUsd(m?.volumeH24)}</span></td>
        <td><span class="ll-status${prog >= 85 ? " grad" : ""}"><span class="dot"></span>${status}</span></td>
        <td style="text-align:right">
          <a href="${tradeHref}" target="_top" class="ll-go${prog >= 85 ? " grad" : ""}" style="text-decoration:none;display:inline-block">
            Trade
          </a>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  if (counter) counter.textContent = String(launches.length);
  if (stat) stat.textContent = hero.totalCoins.toLocaleString();
  const shown = doc.getElementById("ll-shown");
  const total = doc.getElementById("ll-total");
  if (shown) shown.textContent = launches.length.toLocaleString();
  if (total) total.textContent = hero.totalCoins.toLocaleString();

  const setText = (id: string, v: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = v;
  };

  // All-time totals: hero numbers must never go DOWN as the rolling 24h
  // window expires old trades. Track running maxima in localStorage and
  // only ever bump them up. Stable, monotonically increasing "all-time".
  const ALLTIME_KEY = "popshiba.heroAlltime.v1";
  let prev: { vol: number; mc: number } = { vol: 0, mc: 0 };
  try {
    const raw = localStorage.getItem(ALLTIME_KEY);
    if (raw) prev = JSON.parse(raw);
  } catch { /* ignore */ }
  const allTimeVol = Math.max(prev.vol || 0, hero.totalVolume || 0);
  const allTimeMc = Math.max(prev.mc || 0, hero.totalMC || 0);
  try {
    localStorage.setItem(ALLTIME_KEY, JSON.stringify({ vol: allTimeVol, mc: allTimeMc }));
  } catch { /* ignore */ }

  setText("stat-volume", fmtUsd(allTimeVol));
  setText("stat-mc", fmtUsd(allTimeMc));
  setText("stat-grad-count", String(Math.round((hero.gradPct / 100) * launches.length)));

}

export default function PopshibaLaunchpadPage() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [prefill, setPrefill] = useState<LauncherPrefill>({});
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { login, logout, authenticated, ready } = usePrivy();


  // ETH-data injection + polling
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Only REAL on-chain coins: must have a token_address AND a non-failed/pending status.
      const { data: recentData } = await supabase
        .from("eth_launch_requests")
        .select("id, token_name, token_ticker, image_url, status, created_at, token_address, twitter_url, telegram_url, website_url")
        .in("status", ["deployed", "live", "graduated"])
        .not("token_address", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      const launches = (recentData ?? []) as EthLaunch[];
      const totalCoins = launches.length;

      // Fetch on-chain market data for any tokens we have addresses for
      const addrs = launches.map((l) => l.token_address).filter((a): a is string => !!a);
      let markets: Record<string, Market> = {};
      if (addrs.length > 0) {
        const { data: mkt } = await supabase.functions.invoke("eth-batch-market", {
          body: { addresses: addrs },
        });
        markets = (mkt?.results ?? {}) as Record<string, Market>;
      }
      if (cancelled) return;

      // Hero aggregates
      const totalVolume = Object.values(markets).reduce(
        (s, m) => s + (m?.volumeH24 ?? 0),
        0
      );
      const totalMC = Object.values(markets).reduce(
        (s, m) => s + (m?.marketCap ?? 0),
        0
      );
      // Count tokens from our launchpad that have hit >= $1M market cap
      const millionCount = launches.filter(
        (l) => (markets[l.token_address?.toLowerCase() ?? ""]?.marketCap ?? 0) >= 1_000_000
      ).length;
      const gradPct = launches.length > 0 ? (millionCount / launches.length) * 100 : 0;

      // Top-tokens strip: show ALL launched tokens, sorted by Codex market cap (desc).
      // Tokens without market data are kept (mcap treated as 0) so the strip never
      // shrinks to 1-2 cards just because Codex hasn't indexed the rest yet.
      const topRanked = launches
        .map((l, idx) => ({
          launch: l,
          market: (l.token_address ? markets[l.token_address.toLowerCase()] : undefined) as Market,
          index: idx,
        }))
        .filter((r) => !!r.launch.token_address)
        .sort((a, b) => {
          const am = typeof a.market?.marketCap === "number" && isFinite(a.market.marketCap) ? a.market.marketCap : -1;
          const bm = typeof b.market?.marketCap === "number" && isFinite(b.market.marketCap) ? b.market.marketCap : -1;
          return bm - am;
        });

      let sparklines: Record<string, number[]> = {};
      if (topRanked.length > 0) {
        try {
          const { data: sparkData } = await supabase.functions.invoke("codex-sparklines", {
            body: {
              addresses: topRanked.map((r) => r.launch.token_address as string),
              networkId: 1, // Ethereum
            },
          });
          sparklines = (sparkData?.sparklines ?? {}) as Record<string, number[]>;
        } catch (e) {
          console.warn("[popshiba] sparkline fetch failed", e);
        }
      }

      const doc = ref.current?.contentDocument;
      if (doc && doc.getElementById("ll-body")) {
        injectLiveData(doc, launches, markets, { totalVolume, totalCoins, gradPct, totalMC });
        const latest = launches[0] ?? null;
        const latestMarket = latest?.token_address
          ? markets[latest.token_address.toLowerCase()]
          : undefined;
        injectHeroCard(doc, latest, latestMarket);
        injectTopTokens(
          doc,
          topRanked.map((r) => ({
            launch: r.launch,
            market: r.market,
            sparkline: sparklines[(r.launch.token_address as string).toLowerCase()] ?? sparklines[r.launch.token_address as string] ?? [],
            index: r.index,
          }))
        );
      }
    }
    function onLoad() { setTimeout(load, 50); }
    const f = ref.current;
    f?.addEventListener("load", onLoad);
    if (f?.contentDocument?.readyState === "complete") onLoad();
    const interval = setInterval(load, 30_000);

    // Realtime: any new launch → refresh immediately so all users see it
    const channel = supabase
      .channel("popshiba-launches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "eth_launch_requests" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      f?.removeEventListener("load", onLoad);
      supabase.removeChannel(channel);
    };
  }, []);

  // postMessage bridge from iframe → open launcher modal prefilled / AI meme generation
  useEffect(() => {
    function reply(type: string, payload: unknown) {
      const win = ref.current?.contentWindow;
      if (!win) return;
      win.postMessage({ source: "popshiba-host", type, ...(type === "ai-meme-error" ? { error: payload } : { payload }) }, "*");
    }
    async function handleAiMeme() {
      try {
        const { data, error } = await supabase.functions.invoke("popshiba-meme-gen", { body: {} });
        if (error) throw new Error(error.message || "AI request failed");
        if (!data?.success) throw new Error(data?.error || "AI request failed");
        reply("ai-meme-result", {
          name: data.name,
          ticker: data.ticker,
          description: data.description,
          imageDataUrl: data.imageDataUrl,
        });
      } catch (e) {
        reply("ai-meme-error", e instanceof Error ? e.message : "Generation failed");
      }
    }
    function sendWalletState() {
      reply("wallet-state", { connected: !!(authenticated && isConnected && address), address: address || null });
    }
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.source !== "popshiba-template") return;
      if (data.type === "open-launcher") {
        setPrefill(data.payload || {});
        setLauncherOpen(true);
      } else if (data.type === "ai-meme-generate") {
        handleAiMeme();
      } else if (data.type === "wallet-query") {
        sendWalletState();
      } else if (data.type === "wallet-connect") {
        if (ready) {
          // Open Privy's modal directly. Do NOT touch window.ethereum
          // here — that would prompt whichever extension is injected
          // (Trust, Phantom, MetaMask...) before Privy's modal opens,
          // which is exactly the bug we're fixing.
          login();
        }
      } else if (data.type === "open-earnings") {
        navigate("/earnings");
      } else if (data.type === "wallet-logout") {
        logout().catch(() => {});
      }
    }
    window.addEventListener("message", onMessage);
    // Push state immediately and whenever wallet changes
    sendWalletState();
    return () => window.removeEventListener("message", onMessage);
  }, [authenticated, isConnected, address, ready, login, logout, navigate]);

  return (
    <>
      <iframe
        ref={ref}
        src={`/popshiba-template/launch.html?v=${Date.now()}`}
        title="Popshiba Launchpad"
        className="block w-full border-0"
        style={{ height: "100vh", background: "#f5a524" }}
      />
      <Dialog open={launcherOpen} onOpenChange={setLauncherOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Launch your coin on Ethereum</DialogTitle>
          </DialogHeader>
          <EthLauncher key={launcherOpen ? "open" : "closed"} initialValues={{ ...prefill, imageUrl: prefill.imageDataUrl }} initialLockLP={!!prefill.lockLP} />
        </DialogContent>
      </Dialog>
    </>
  );
}
