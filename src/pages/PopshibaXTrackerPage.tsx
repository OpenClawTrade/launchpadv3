// Popshiba X Tracker — KOL tweet feed restyled to match the Popshiba aesthetic.
// Reads the existing kol_contract_tweets data via useKolTweets.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useKolTweets, type KolTweet } from "@/hooks/useKolTweets";
import { useKolScanStatus } from "@/hooks/useKolScanStatus";
import { supabase } from "@/integrations/supabase/client";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { ArrowLeft, RefreshCw, Radar, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ChainFilter = "all" | "solana" | "evm";

const SHORT = (s: string) => (s.length <= 12 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`);
const fmtUsd = (n: number | null) => {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
};
function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function PopshibaXTrackerPage() {
  const [chain, setChain] = useState<ChainFilter>("all");
  const { data: tweets, isLoading, refetch, isFetching } = useKolTweets(chain);
  const { latestRun, errors } = useKolScanStatus();
  const [running, setRunning] = useState(false);

  const handleManualScan = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke("scan-kol-tweets");
    } catch (e) {
      console.error("[XTracker] scan failed", e);
    } finally {
      setRunning(false);
      refetch();
    }
  };

  return (
    <div className="min-h-screen bg-pop-cream text-pop-ink">
      <PopshibaTopNav />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-[12px] uppercase font-pop-mono tracking-[0.1em] text-pop-ink/70 hover:text-pop-ink mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back home
        </Link>

        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-pop-mono text-[11px] tracking-[0.18em] uppercase text-pop-ink/60 mb-2">
              // Live KOL radar
            </div>
            <h1 className="font-pop-display text-[36px] sm:text-[48px] leading-[0.95] tracking-[-0.02em] flex items-center gap-3">
              <Radar className="w-9 h-9 text-pop-orange" /> Tracker
            </h1>
            <p className="font-pop-mono text-[12px] uppercase tracking-[0.1em] text-pop-ink/70 mt-2">
              Tweets from tracked KOLs that mention contract addresses
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleManualScan}
              disabled={running}
              className="inline-flex items-center gap-2 font-bold text-[12px] px-4 py-2.5 border-2 border-pop-ink bg-pop-ink text-pop-cream shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-60"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              {running ? "Scanning…" : "Run scan"}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 font-bold text-[12px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Scanner status */}
        {latestRun && (
          <section className="mb-6 border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4">
            <div className="font-pop-mono text-[10px] uppercase tracking-[0.18em] text-pop-ink/65 mb-3">
              // Scanner status
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Stat label="Last run" value={formatDistanceToNow(new Date(latestRun.created_at), { addSuffix: true })} compact />
              <Stat label="Accounts" value={String(latestRun.accounts_scanned)} compact />
              <Stat label="Tweets" value={String(latestRun.tweets_fetched)} compact />
              <Stat label="CAs found" value={String(latestRun.cas_detected)} compact />
              <Stat label="Inserted" value={String(latestRun.tweets_inserted)} compact />
            </div>
            {(() => {
              // Hide third-party billing/credit errors from public visitors —
              // these are operational issues we handle internally.
              const visibleErrors = errors.filter((e) => {
                const msg = (e.error_message || "").toLowerCase();
                return !msg.includes("credits is not enough")
                  && !msg.includes("please recharge")
                  && !msg.includes("http 402");
              });
              if (visibleErrors.length === 0) return null;
              return (
                <div className="mt-3 border-2 border-rose-700 bg-rose-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    <span className="font-pop-mono text-[10px] uppercase tracking-[0.1em] text-rose-800 font-bold">
                      {visibleErrors.length} errors
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {visibleErrors.slice(0, 5).map((e) => (
                      <div key={e.id} className="text-[11px] text-rose-900/80 font-pop-mono">
                        <span className="font-bold">@{e.kol_username}</span>: {e.error_message.substring(0, 150)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Chain filter */}
        <div className="flex items-center gap-0 mb-5 border-2 border-pop-ink bg-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] w-fit">
          {(["all", "solana", "evm"] as ChainFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`px-4 py-2 font-pop-display text-[12px] tracking-[0.06em] uppercase transition-colors ${
                chain === c ? "bg-pop-orange text-pop-ink" : "text-pop-cream/75 hover:text-pop-cream"
              }`}
            >
              {c === "all" ? "All" : c === "solana" ? "Solana" : "EVM"}
            </button>
          ))}
        </div>

        {/* Tweet grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 border-2 border-pop-ink bg-white animate-pulse shadow-[3px_3px_0_hsl(var(--pop-ink))]" />
            ))}
          </div>
        ) : tweets && tweets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tweets.map((t) => <PopshibaTweetCard key={t.id} tweet={t} />)}
          </div>
        ) : (
          <div className="border-2 border-pop-ink bg-white p-12 text-center shadow-[3px_3px_0_hsl(var(--pop-ink))]">
            <Radar className="w-10 h-10 mx-auto text-pop-ink/30 mb-3" />
            <p className="font-pop-display text-[18px] tracking-[-0.01em]">No tweets yet</p>
            <p className="font-pop-mono text-[11px] uppercase tracking-[0.1em] text-pop-ink/60 mt-2 max-w-md mx-auto">
              {latestRun && latestRun.tweets_fetched === 0
                ? "Scanner is running but no tweets are being extracted."
                : latestRun && latestRun.cas_detected === 0
                  ? "Tweets are being fetched but no contract addresses were found."
                  : "Scanner runs every 15 minutes — or hit Run scan."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`border-[1.5px] border-pop-ink bg-pop-cream/60 ${compact ? "p-2" : "p-4"}`}>
      <div className="font-pop-mono text-[10px] uppercase tracking-[0.1em] text-pop-ink/70">{label}</div>
      <div className={`font-pop-display tabular-nums ${compact ? "text-[15px]" : "text-[28px]"} tracking-[-0.01em] mt-0.5`}>
        {value}
      </div>
    </div>
  );
}

function PopshibaTweetCard({ tweet }: { tweet: KolTweet }) {
  const isSolana = tweet.chain === "solana";
  const tradeUrl = isSolana ? `/trade/${tweet.contract_address}` : `/ape/${tweet.contract_address}`;
  const explorer = isSolana
    ? `https://solscan.io/token/${tweet.contract_address}`
    : `https://etherscan.io/token/${tweet.contract_address}`;

  return (
    <article className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-3 flex flex-col gap-3 hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        {tweet.kol_profile_image ? (
          <img
            src={tweet.kol_profile_image}
            alt={tweet.kol_username}
            className="w-9 h-9 border-2 border-pop-ink object-cover"
          />
        ) : (
          <div className="w-9 h-9 border-2 border-pop-ink bg-pop-cream flex items-center justify-center font-pop-display text-[12px]">
            {tweet.kol_username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={`https://twitter.com/${tweet.kol_username}`}
            target="_blank" rel="noopener noreferrer"
            className="block font-bold text-[13px] truncate hover:text-pop-orange"
          >
            @{tweet.kol_username}
          </a>
          <div className="font-pop-mono text-[10px] uppercase tracking-[0.08em] text-pop-ink/60">
            {timeAgo(tweet.tweeted_at)} · {tweet.chain}
          </div>
        </div>
        {tweet.tweet_url && (
          <a
            href={tweet.tweet_url}
            target="_blank" rel="noopener noreferrer"
            className="text-pop-ink/60 hover:text-pop-orange shrink-0"
            title="View tweet"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Tweet body */}
      {tweet.tweet_text && (
        <p className="text-[12.5px] text-pop-ink/85 leading-snug line-clamp-4 break-words">
          {tweet.tweet_text}
        </p>
      )}

      {/* Token chip */}
      <div className="border-[1.5px] border-pop-ink bg-pop-cream p-2.5 flex items-center gap-2.5">
        {tweet.token_image_url ? (
          <img
            src={tweet.token_image_url}
            alt=""
            className="w-8 h-8 border-2 border-pop-ink object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 border-2 border-pop-ink bg-white flex items-center justify-center font-pop-display text-[11px] shrink-0">
            {(tweet.token_symbol || "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[12.5px] truncate">
            {tweet.token_name || tweet.token_symbol || SHORT(tweet.contract_address)}
          </div>
          <div className="font-pop-mono text-[10px] uppercase tracking-[0.08em] text-pop-ink/60 truncate">
            {tweet.token_symbol ? `$${tweet.token_symbol} · ` : ""}{fmtUsd(tweet.token_market_cap)} MC
          </div>
        </div>
        <a
          href={explorer}
          target="_blank" rel="noopener noreferrer"
          className="text-pop-ink/60 hover:text-pop-orange shrink-0"
          title="Explorer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* CTA */}
      <Link
        to={tradeUrl}
        className="inline-flex items-center justify-center gap-1.5 font-bold text-[11px] px-3 py-2 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] transition-all uppercase tracking-[0.06em]"
      >
        Trade →
      </Link>
    </article>
  );
}
