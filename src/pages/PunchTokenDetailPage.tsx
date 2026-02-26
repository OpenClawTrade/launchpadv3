import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { useSolPrice } from "@/hooks/useSolPrice";
import { usePoolState } from "@/hooks/usePoolState";
import { PunchStatsFooter } from "@/components/punch/PunchStatsFooter";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { TokenDataTabs } from "@/components/launchpad/TokenDataTabs";
import { TokenComments } from "@/components/launchpad/TokenComments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Copy, CheckCircle, ExternalLink, Share2, ArrowLeft, Zap,
  BarChart3, MessageCircle, Info, Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD = 85;

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export default function PunchTokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { solPrice } = useSolPrice();
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chart" | "info">("chart");
  const [showFullDesc, setShowFullDesc] = useState(false);

  const { data: token, isLoading } = useFunToken(mintAddress || "");

  const { data: livePoolState } = usePoolState({
    mintAddress: token?.mint_address || "",
    enabled: !!token?.mint_address && token?.status === "active",
    refetchInterval: 60000,
  });

  const bondingProgress = livePoolState?.bondingProgress ?? token?.bonding_progress ?? 0;
  const realSolReserves = (bondingProgress / 100) * GRADUATION_THRESHOLD;

  const copyAddress = () => {
    if (mintAddress) {
      navigator.clipboard.writeText(mintAddress);
      setCopiedAddress(true);
      toast({ title: "Address copied!" });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const shareToken = () => {
    if (navigator.share && token) {
      navigator.share({
        title: `${token.name} ($${token.ticker})`,
        text: `Check out ${token.name} on Punch Launch! 🐵`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  const formatUsd = (sol: number) => {
    const usd = sol * (solPrice || 0);
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd > 0) return `$${usd.toFixed(4)}`;
    return "$0";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)" }}>
        <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-3">
          <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
          <Skeleton className="h-[300px] w-full rounded-xl bg-white/10" />
          <Skeleton className="h-32 w-full rounded-xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)" }}>
        <p className="text-white/60 text-lg font-mono mb-4">Token not found</p>
        <Link to="/punch-test">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold">Back to Punch</Button>
        </Link>
      </div>
    );
  }

  const stats = [
    { label: "MCAP", value: formatUsd(token.market_cap_sol || 0) },
    { label: "PRICE", value: `${(token.price_sol || 0).toFixed(8)} SOL` },
    { label: "HOLDERS", value: (token.holder_count || 0).toString() },
    { label: "VOL 24H", value: `${formatCompact(token.volume_24h_sol || 0)} SOL` },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/10" style={{ background: "rgba(10,10,10,0.85)" }}>
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/punch-test">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>

          <Avatar className="h-9 w-9 rounded-lg border border-white/20">
            <AvatarImage src={token.image_url || undefined} className="object-cover" />
            <AvatarFallback className="rounded-lg text-[10px] font-bold bg-orange-500/20 text-orange-400 font-mono">
              {token.ticker.slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white font-mono truncate">{token.name}</h1>
              <span className="text-xs font-mono text-white/40">${token.ticker}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
                🐵 PUNCH
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10" onClick={copyAddress}>
              {copiedAddress ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10" onClick={shareToken}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <a href={`https://solscan.io/token/${mintAddress}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-3 md:px-4 pb-24 space-y-2.5 mt-2">

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-px rounded-xl overflow-hidden border border-white/10">
          {stats.map((s, i) => (
            <div key={i} className="px-2 py-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{s.label}</p>
              <p className="text-xs font-mono font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Bonding progress */}
        {token.status === "active" && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Zap className="h-4 w-4 text-orange-400 shrink-0" />
            <span className="text-[10px] font-mono text-white/50 uppercase shrink-0">Bonding</span>
            <div className="flex-1">
              <div className="w-full rounded-full overflow-hidden bg-white/10 h-2">
                <div className="rounded-full h-2" style={{
                  width: `${Math.max(Math.min(bondingProgress, 100), 1)}%`,
                  background: "linear-gradient(90deg, #f97316, #fb923c)",
                  boxShadow: "0 0 12px rgba(249,115,22,0.5)",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-orange-400 shrink-0">{bondingProgress.toFixed(1)}%</span>
            <span className="text-[10px] font-mono text-white/40 shrink-0">{realSolReserves.toFixed(1)}/{GRADUATION_THRESHOLD} SOL</span>
            {livePoolState && (
              <span className="flex items-center gap-1 text-[9px] font-mono text-orange-400 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />LIVE
              </span>
            )}
          </div>
        )}

        {/* Trading coming soon */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <Lock className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-mono text-orange-300">Trading coming soon for Punch tokens</span>
        </div>

        {/* Mobile tab switcher */}
        <div className="md:hidden grid grid-cols-2 gap-px rounded-xl overflow-hidden border border-white/10">
          {(["chart", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`py-3 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                mobileTab === tab
                  ? "bg-orange-500/10 text-orange-400 font-bold border-b-2 border-orange-400"
                  : "text-white/40 hover:text-white/60"
              }`}
              style={{ background: mobileTab === tab ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)" }}
            >
              {tab === "chart" && <BarChart3 className="h-4 w-4" />}
              {tab === "info" && <Info className="h-4 w-4" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Phone layout */}
        <div className="md:hidden flex flex-col gap-2.5">
          {mobileTab === "chart" && (
            <>
              <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: "#0a0a0a" }}>
                <CodexChart tokenAddress={token.mint_address || mintAddress || ""} height={340} />
              </div>
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ""} holderCount={token.holder_count || 0} />
            </>
          )}
          {mobileTab === "info" && (
            <>
              <TokenInfoPanel token={token} solPrice={solPrice} mintAddress={mintAddress || ""} copyAddress={copyAddress} showFullDesc={showFullDesc} setShowFullDesc={setShowFullDesc} />
              <div className="rounded-xl border border-white/10 p-3 flex flex-col" style={{ background: "rgba(255,255,255,0.03)" }}>
                <h3 className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1 mb-2">
                  <MessageCircle className="h-3 w-3" /> Discussion
                </h3>
                <TokenComments tokenId={token.id} />
              </div>
            </>
          )}
        </div>

        {/* Desktop layout */}
        <div className="hidden md:grid grid-cols-12 gap-2.5">
          <div className="col-span-8 flex flex-col gap-2.5">
            <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: "#0a0a0a" }}>
              <CodexChart tokenAddress={token.mint_address || mintAddress || ""} height={420} />
            </div>
            <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ""} holderCount={token.holder_count || 0} />
          </div>
          <div className="col-span-4 flex flex-col gap-2.5">
            <TokenInfoPanel token={token} solPrice={solPrice} mintAddress={mintAddress || ""} copyAddress={copyAddress} showFullDesc={showFullDesc} setShowFullDesc={setShowFullDesc} />
            <div className="rounded-xl border border-white/10 p-3 flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
              <h3 className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1 mb-2">
                <MessageCircle className="h-3 w-3" /> Discussion
              </h3>
              <div className="flex-1 overflow-y-auto">
                <TokenComments tokenId={token.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Punch footer */}
      <PunchStatsFooter />
    </div>
  );
}

/* ── Token info sub-panel ── */
function TokenInfoPanel({
  token,
  solPrice,
  mintAddress,
  copyAddress,
  showFullDesc,
  setShowFullDesc,
}: {
  token: any;
  solPrice: number;
  mintAddress: string;
  copyAddress: () => void;
  showFullDesc: boolean;
  setShowFullDesc: (v: boolean) => void;
}) {
  const formatUsd = (sol: number) => {
    const usd = sol * (solPrice || 0);
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    return "$0";
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Token image + name */}
      <div className="rounded-xl border border-white/10 p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        <Avatar className="h-14 w-14 rounded-xl border border-white/20">
          <AvatarImage src={token.image_url || undefined} className="object-cover" />
          <AvatarFallback className="rounded-xl text-lg font-bold bg-orange-500/20 text-orange-400 font-mono">
            {token.ticker.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-base font-bold text-white font-mono">{token.name}</h2>
          <span className="text-xs font-mono text-white/40">${token.ticker}</span>
          <p className="text-[10px] font-mono text-white/30 mt-0.5">
            Created {formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Details rows */}
      <div className="rounded-xl border border-white/10 p-3 space-y-0" style={{ background: "rgba(255,255,255,0.03)" }}>
        <h3 className="text-[10px] font-mono uppercase text-white/40 mb-1">Details</h3>
        {[
          { label: "Price", value: `${(token.price_sol || 0).toFixed(8)} SOL` },
          { label: "Market Cap", value: formatUsd(token.market_cap_sol || 0) },
          { label: "Volume 24h", value: `${formatCompact(token.volume_24h_sol || 0)} SOL` },
          { label: "Holders", value: (token.holder_count || 0).toString() },
          { label: "Supply", value: formatCompact(1_000_000_000) },
        ].map((row, i) => (
          <div key={i} className="flex justify-between text-xs font-mono py-1.5 border-b border-white/5 last:border-0">
            <span className="text-white/40">{row.label}</span>
            <span className="text-white/80 font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Contract */}
      {token.mint_address && (
        <div className="rounded-xl border border-white/10 p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <h3 className="text-[10px] font-mono uppercase text-white/40 mb-1">Contract</h3>
          <div className="flex items-center gap-2">
            <code className="text-[10px] font-mono text-white/60 truncate flex-1">
              {token.mint_address.slice(0, 12)}...{token.mint_address.slice(-6)}
            </code>
            <button onClick={copyAddress} className="text-white/40 hover:text-white p-1">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Description */}
      {token.description && (
        <div className="rounded-xl border border-white/10 p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className={`text-xs font-mono text-white/50 leading-relaxed ${!showFullDesc ? "line-clamp-3" : ""}`}>
            {token.description}
          </p>
          {token.description.length > 100 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-[10px] font-mono text-orange-400 hover:underline mt-1 flex items-center gap-0.5"
            >
              {showFullDesc ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
            </button>
          )}
        </div>
      )}

      {/* Links */}
      <div className="flex gap-2 flex-wrap">
        <a href={`https://solscan.io/token/${mintAddress}`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 text-xs font-mono gap-1 border-white/10 text-white/60 hover:text-white hover:bg-white/5">
            <ExternalLink className="h-3 w-3" /> Solscan
          </Button>
        </a>
        <a href={`https://axiom.trade/meme/${token.dbc_pool_address || mintAddress}?chain=sol`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="h-8 text-xs font-mono gap-1 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            Axiom
          </Button>
        </a>
      </div>
    </div>
  );
}
