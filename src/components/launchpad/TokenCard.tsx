import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bot, Crown, Copy, CheckCircle, TrendingUp, TrendingDown, BadgeCheck } from "lucide-react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { PhantomBadge } from "@/components/clawbook/PhantomBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TokenCardProps {
  token: FunToken;
  solPrice: number | null;
  isPromoted?: boolean;
  creatorUsername?: string | null;
  creatorAvatarUrl?: string | null;
  creatorVerified?: boolean;
}

interface XProfileInfo {
  profileImageUrl: string | null;
  verified: boolean;
  verifiedType: string | null; // 'blue' | 'business' | 'government' | null
}

// Simple in-memory cache to avoid re-fetching
const xProfileCache = new Map<string, XProfileInfo>();

function formatUsd(mcapSol: number | null | undefined, solPrice: number | null): string {
  if (!mcapSol || !solPrice) return "$0";
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatAge(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: false })
    .replace("about ", "")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo");
}

/** Extract X username from twitter_url like https://x.com/username/status/... */
function extractXUsername(twitterUrl?: string | null): string | null {
  if (!twitterUrl) return null;
  try {
    const url = new URL(twitterUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

export function TokenCard({ token, solPrice, isPromoted, creatorUsername, creatorAvatarUrl, creatorVerified }: TokenCardProps) {
  const [copiedCA, setCopiedCA] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [xProfile, setXProfile] = useState<XProfileInfo | null>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const isPumpFun = token.launchpad_type === 'pumpfun';
  const isBags = token.launchpad_type === 'bags';
  const isPhantom = token.launchpad_type === 'phantom';
  const isAgent = !!token.agent_id;
  const isNearGrad = (token.bonding_progress ?? 0) >= 80;
  const priceChange = token.price_change_24h ?? 0;
  const isPositive = priceChange >= 0;
  const bondingProgress = token.bonding_progress ?? 0;

  // Derive X username from twitter_url or use passed-in prop
  const xUsername = creatorUsername || extractXUsername(token.twitter_url);

  // Fetch X profile info (avatar + verified) via edge function
  useEffect(() => {
    if (!xUsername) return;
    // If props already provide avatar, skip
    if (creatorAvatarUrl) {
      setXProfile({ profileImageUrl: creatorAvatarUrl, verified: creatorVerified ?? false, verifiedType: null });
      return;
    }

    const cached = xProfileCache.get(xUsername.toLowerCase());
    if (cached) {
      setXProfile(cached);
      return;
    }

    let cancelled = false;
    supabase.functions.invoke('twitter-user-info', {
      body: { username: xUsername },
    }).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const info: XProfileInfo = {
        profileImageUrl: data.profileImageUrl || null,
        verified: data.verified || false,
        verifiedType: data.verifiedType || null,
      };
      xProfileCache.set(xUsername.toLowerCase(), info);
      setXProfile(info);
    });

    return () => { cancelled = true; };
  }, [xUsername, creatorAvatarUrl, creatorVerified]);

  const tradeUrl = (isPumpFun || isBags || isAgent)
    ? `/t/${token.ticker}`
    : `/launchpad/${token.mint_address}`;

  const mcapFormatted = formatUsd(token.market_cap_sol, solPrice);

  // Random subtle shake animation on ~15% of cards every 6-12s
  useEffect(() => {
    const shouldShake = Math.random() < 0.15;
    if (!shouldShake) return;
    
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 600);
      }
    }, 6000 + Math.random() * 6000);

    return () => clearInterval(interval);
  }, []);

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopiedCA(true);
      toast.success("CA copied!");
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  // Determine avatar and verified from fetched profile or props
  const avatarUrl = xProfile?.profileImageUrl || creatorAvatarUrl || null;
  const isVerified = xProfile?.verified || creatorVerified || false;
  const verifiedType = xProfile?.verifiedType; // 'blue' | 'business' | 'government'

  // Checkmark color: gold for business/government, blue for blue/default
  const checkColor = (verifiedType === 'business' || verifiedType === 'government')
    ? "hsl(38 92% 50%)" // gold
    : "hsl(210 100% 50%)"; // blue

  return (
    <Link
      ref={cardRef}
      to={tradeUrl}
      className={`lt-card group block overflow-hidden ${isPulsing ? 'lt-shake' : ''} ${isNearGrad ? 'lt-card-hot' : ''}`}
    >
      {/* Token Image */}
      <div className="relative w-full" style={{ paddingBottom: "58%" }}>
        <div className="absolute inset-0">
          {token.image_url ? (
            <img
              src={token.image_url}
              alt={token.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ background: "hsl(var(--muted))", color: "hsl(var(--success))" }}>
              {token.ticker?.slice(0, 2)}
            </div>
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 50%)" }} />

          {/* MC + badges overlay */}
          <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-foreground">{mcapFormatted}</span>
            <div className="flex items-center gap-1">
              {isNearGrad && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "hsl(24 95% 53%)", color: "white" }}>
                  🔥
                </span>
              )}
              {isAgent && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "hsl(var(--accent-purple))", color: "white" }}>
                  <Bot className="h-2.5 w-2.5 inline" /> AI
                </span>
              )}
              {isPromoted && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "hsl(38 92% 50%)", color: "white" }}>
                  <Crown className="h-2.5 w-2.5 inline" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-2.5">
        {/* Name + ticker + price change */}
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[11px] font-bold text-foreground truncate leading-tight">
            {token.name}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] font-mono" style={{ color: "hsl(var(--success))" }}>
              ${token.ticker}
            </span>
            {priceChange !== 0 && (
              <span className={`flex items-center gap-0.5 text-[8px] font-bold ${isPositive ? 'lt-price-up' : 'lt-price-down'}`}>
                {isPositive ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
                {Math.abs(priceChange).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Source badges + age */}
        <div className="flex items-center gap-1 mb-1">
          {isPumpFun && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
          {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
          {isPhantom && <PhantomBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" />}
          <span className="text-[8px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{formatAge(token.created_at)} ago</span>
        </div>

        {/* Description */}
        {token.description && (
          <p className="text-[9px] leading-tight line-clamp-2 mb-1.5" style={{ color: "hsl(var(--foreground-secondary))" }}>
            {token.description}
          </p>
        )}

        {/* Creator X attribution with fetched avatar + verified badge */}
        {xUsername && (
          <a
            href={token.twitter_url || `https://x.com/${xUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 mb-1.5 hover:opacity-80 transition-opacity"
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={`@${xUsername}`} 
                className="w-4 h-4 rounded-full object-cover ring-1 ring-border flex-shrink-0" 
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                {xUsername[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-[9px] font-medium truncate" style={{ color: "hsl(187 80% 53%)" }}>
              @{xUsername}
            </span>
            {isVerified && (
              <BadgeCheck className="h-3 w-3 flex-shrink-0" style={{ color: checkColor }} />
            )}
          </a>
        )}

        {/* CA copy row */}
        {token.mint_address && (
          <button
            onClick={handleCopyCA}
            className="flex items-center gap-1 w-full text-left group/ca"
          >
            <code className="text-[7px] font-mono truncate flex-1" style={{ color: "hsl(var(--muted-foreground))" }}>
              {token.mint_address.slice(0, 6)}...{token.mint_address.slice(-4)}
            </code>
            {copiedCA ? (
              <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "hsl(160 84% 50%)" }} />
            ) : (
              <Copy className="h-2.5 w-2.5 flex-shrink-0 transition-colors" style={{ color: "hsl(var(--muted-foreground))" }} />
            )}
          </button>
        )}

        {/* Bonding progress bar — always visible with min width */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted) / 0.6)", border: "1px solid hsl(var(--border) / 0.4)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                // Minimum 4% width so even 0% shows a sliver; cap at 100%
                width: `${Math.max(Math.min(bondingProgress, 100), 4)}%`,
                background: bondingProgress >= 80
                  ? "linear-gradient(90deg, hsl(24 95% 53%), hsl(16 85% 48%))"
                  : bondingProgress > 0
                    ? "linear-gradient(90deg, hsl(160 84% 39%), hsl(142 76% 36%))"
                    : "hsl(var(--muted-foreground) / 0.35)",
              }}
            />
          </div>
          <span className="text-[8px] font-mono flex-shrink-0" style={{ color: bondingProgress >= 80 ? "hsl(24 95% 60%)" : "hsl(var(--muted-foreground))" }}>
            {bondingProgress.toFixed(bondingProgress >= 1 ? 0 : 1)}%
          </span>
        </div>
      </div>
    </Link>
  );
}
