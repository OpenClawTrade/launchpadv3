import { useMemo } from "react";
import { ExternalLink, BarChart3 } from "lucide-react";
import { useKolTweets, type KolTweet } from "@/hooks/useKolTweets";
import { Link } from "react-router-dom";

const AV_COLORS: Record<string, string> = {
  y: "bg-pop-orange text-pop-ink",
  g: "bg-[#4ea65f] text-white",
  b: "bg-[#2d65c9] text-white",
  p: "bg-[#c94dc9] text-white",
  r: "bg-[#c94d4d] text-white",
};

function pickColor(seed: string): keyof typeof AV_COLORS {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (["y", "g", "b", "p", "r"] as const)[h % 5];
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtUsd(v: number | null) {
  if (v == null) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(3)}`;
}

function XCard({ tweet }: { tweet: KolTweet }) {
  const isSol = tweet.chain === "solana";
  const tradeUrl = isSol ? `/trade/${tweet.contract_address}` : `https://etherscan.io/token/${tweet.contract_address}`;
  const avColor = pickColor(tweet.kol_username);
  const tokColor = pickColor(tweet.token_symbol || tweet.contract_address);

  return (
    <div className="border-2 border-pop-orange bg-[#171310] shadow-[4px_4px_0_hsl(var(--pop-orange))] p-3.5 flex flex-col gap-2.5">
      {/* head */}
      <div className="flex items-start gap-2.5">
        {tweet.kol_profile_image ? (
          <img
            src={tweet.kol_profile_image}
            alt=""
            className="w-9 h-9 rounded-full border-2 border-pop-orange object-cover shrink-0"
          />
        ) : (
          <div className={`w-9 h-9 rounded-full border-2 border-pop-orange flex items-center justify-center font-pop-display text-[13px] shrink-0 ${AV_COLORS[avColor]}`}>
            {tweet.kol_username[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-pop-display text-[13px] text-pop-cream tracking-[-0.01em] truncate">
            @{tweet.kol_username}
          </div>
          <div className="font-pop-mono text-[10px] text-[#a49a8a]">{timeAgo(tweet.tweeted_at)}</div>
        </div>
      </div>

      {/* tweet text */}
      {tweet.tweet_text && (
        <p className="text-[12px] leading-[1.45] text-pop-cream/90 line-clamp-3 break-words">
          {tweet.tweet_text}
        </p>
      )}

      {/* token block */}
      <div className="flex items-center gap-2.5 p-2.5 bg-pop-ink border-[1.5px] border-dashed border-pop-orange/40">
        {tweet.token_image_url ? (
          <img src={tweet.token_image_url} alt="" className="w-7 h-7 rounded-full border-[1.5px] border-pop-orange object-cover shrink-0" />
        ) : (
          <div className={`w-7 h-7 rounded-full border-[1.5px] border-pop-orange flex items-center justify-center font-pop-display text-[10px] shrink-0 ${AV_COLORS[tokColor]}`}>
            {tweet.token_symbol?.[0] || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-pop-display text-[12px] text-pop-cream truncate">
            {tweet.token_name || "Token"}
          </div>
          {tweet.token_symbol && (
            <div className="font-pop-mono text-[10px] text-pop-orange tracking-[0.08em] mt-0.5">
              ${tweet.token_symbol}
            </div>
          )}
        </div>
        <div className="text-right font-pop-mono shrink-0">
          {tweet.token_price_usd != null && (
            <div className="text-[11px] text-pop-cream font-bold">{fmtUsd(tweet.token_price_usd)}</div>
          )}
          {tweet.token_market_cap != null && (
            <div className="text-[9px] text-[#a49a8a] tracking-[0.05em]">MC {fmtUsd(tweet.token_market_cap)}</div>
          )}
        </div>
        <span
          className={`font-pop-mono text-[9px] tracking-[0.12em] px-2 py-1 font-bold ${
            isSol ? "bg-[#9945ff] text-white" : "bg-[#627eea] text-white"
          }`}
        >
          {isSol ? "SOL" : "EVM"}
        </span>
      </div>

      {/* actions */}
      <div className="flex gap-3 sm:gap-4 border-t border-dashed border-pop-orange/30 pt-2.5 font-pop-mono text-[11px] text-pop-orange font-bold tracking-[0.05em]">
        {tweet.tweet_url && (
          <a href={tweet.tweet_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80">
            <ExternalLink className="w-3 h-3" /> TWEET
          </a>
        )}
        {isSol ? (
          <Link to={tradeUrl} className="inline-flex items-center gap-1 hover:opacity-80">
            <BarChart3 className="w-3 h-3" /> TRADE
          </Link>
        ) : (
          <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80">
            <BarChart3 className="w-3 h-3" /> EXPLORER
          </a>
        )}
      </div>
    </div>
  );
}

export function PopshibaXTracker() {
  const { data } = useKolTweets("all");
  const tweets = useMemo(() => (data || []).slice(0, 4), [data]);

  if (!tweets.length) {
    return (
      <div className="text-center py-10 font-pop-mono text-[11px] text-[#a49a8a]">
        No KOL tweets yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {tweets.map((t) => <XCard key={t.id} tweet={t} />)}
    </div>
  );
}
