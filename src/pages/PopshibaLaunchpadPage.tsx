/**
 * PopshibaLaunchpadPage
 * Pixel-perfect template (iframe) + live ETH data + real launcher modal.
 *
 * - Live launches table, hero stats, and progress bars are populated with
 *   real data from `eth_launch_requests` joined with on-chain market data
 *   (price / MC / 24h vol / 24h change / liquidity) fetched via the
 *   `eth-batch-market` edge function (DexScreener under the hood).
 * - "Trade" button on each row → /trade/:address (escapes iframe with _top).
 * - "🚀 LAUNCH IT" inside iframe → opens real <EthLauncher /> modal,
 *   prefilled from the form values posted up via window.postMessage.
 * - Empty-state CTA when there are no live launches.
 */
import { useEffect, useRef, useState } from "react";
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
  if (link) link.href = latest.token_address ? `/trade/${latest.token_address}` : "#";

  // Socials — wire whatever exists, hide the rest (no flicker of broken links)
  setHref("hp-tw", latest.twitter_url);
  setHref("hp-tg", latest.telegram_url);
  setHref("hp-web", latest.website_url);

  const price = market?.priceUsd ?? null;
  const vol = market?.volumeH24 ?? null;
  const chg = market?.changeH24 ?? null;
  const mc = market?.marketCap ?? 0;
  set("hp-price", price != null ? fmtUsd(price) : "$—");
  set("hp-vol", vol != null ? fmtUsd(vol) : "$—");
  const chgEl = doc.getElementById("hp-chg");
  if (chgEl) {
    chgEl.textContent = fmtPct(chg);
    (chgEl as HTMLElement).style.color = chg == null ? "" : chg >= 0 ? "#0b8a3a" : "#c8372d";
  }
  const pct = Math.max(2, Math.min(100, Math.round((mc / 69_000) * 100)));
  const fill = doc.getElementById("hp-bar-fill") as HTMLElement | null;
  if (fill) fill.style.width = `${pct}%`;
  set("hp-bar-left", `${fmtUsd(mc)} / $69K MC`);
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
      const tradeHref = l.token_address ? `/trade/${l.token_address}` : "#";
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

  const setText = (id: string, v: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = v;
  };
  setText("stat-volume", fmtUsd(hero.totalVolume));
  setText("stat-mc", fmtUsd(hero.totalMC));
  setText("stat-grad-count", String(Math.round((hero.gradPct / 100) * launches.length)));

}

export default function PopshibaLaunchpadPage() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [prefill, setPrefill] = useState<LauncherPrefill>({});

  // ETH-data injection + polling
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [recentRes, totalRes] = await Promise.all([
        supabase
          .from("eth_launch_requests")
          .select("id, token_name, token_ticker, image_url, status, created_at, token_address, twitter_url, telegram_url, website_url")
          .in("status", ["pending", "deploying", "deployed", "live", "graduated"])
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("eth_launch_requests").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const launches = (recentRes.data ?? []) as EthLaunch[];
      const totalCoins = totalRes.count ?? 0;

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

      const doc = ref.current?.contentDocument;
      if (doc && doc.getElementById("ll-body")) {
        injectLiveData(doc, launches, markets, { totalVolume, totalCoins, gradPct, totalMC });
        const latest = launches[0] ?? null;
        const latestMarket = latest?.token_address
          ? markets[latest.token_address.toLowerCase()]
          : undefined;
        injectHeroCard(doc, latest, latestMarket);
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

  // postMessage bridge from iframe → open launcher modal prefilled
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.source !== "popshiba-template") return;
      if (data.type === "open-launcher") {
        setPrefill(data.payload || {});
        setLauncherOpen(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
          <EthLauncher key={launcherOpen ? "open" : "closed"} initialValues={prefill} />
        </DialogContent>
      </Dialog>
    </>
  );
}
