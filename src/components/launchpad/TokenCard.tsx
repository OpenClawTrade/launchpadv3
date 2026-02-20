import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bot, Crown, Flame, Copy, CheckCircle } from "lucide-react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { PhantomBadge } from "@/components/clawbook/PhantomBadge";
import { toast } from "sonner";

interface TokenCardProps {
  token: FunToken;
  solPrice: number | null;
  isPromoted?: boolean;
}

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

export function TokenCard({ token, solPrice, isPromoted }: TokenCardProps) {
  const [copiedCA, setCopiedCA] = useState(false);
  const isPumpFun = token.launchpad_type === 'pumpfun';
  const isBags = token.launchpad_type === 'bags';
  const isPhantom = token.launchpad_type === 'phantom';
  const isAgent = !!token.agent_id;
  const isNearGrad = (token.bonding_progress ?? 0) >= 80;

  const tradeUrl = (isPumpFun || isBags || isAgent)
    ? `/t/${token.ticker}`
    : `/launchpad/${token.mint_address}`;

  const mcapFormatted = formatUsd(token.market_cap_sol, solPrice);

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


  return (
    <Link
      to={tradeUrl}
      className="pf-card group block overflow-hidden"
    >
      {/* Token Image */}
      <div className="relative w-full" style={{ paddingBottom: "62%" }}>
        <div className="absolute inset-0">
          {token.image_url ? (
            <img
              src={token.image_url}
              alt={token.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold pf-card-fallback">
              {token.ticker?.slice(0, 2)}
            </div>
          )}

          {/* Gradient overlay on image bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 pf-img-overlay" />

          {/* MC + badges overlay */}
          <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-foreground">{mcapFormatted}</span>
            <div className="flex items-center gap-1">
              {isNearGrad && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-pill font-bold pf-badge-hot">
                  🔥 HOT
                </span>
              )}
              {isAgent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-pill font-bold pf-badge-agent">
                  <Bot className="h-2.5 w-2.5 inline" /> AI
                </span>
              )}
              {isPromoted && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-pill font-bold pf-badge-promoted">
                  <Crown className="h-2.5 w-2.5 inline" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        {/* Name + ticker row */}
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[12px] font-bold text-foreground truncate leading-tight">
            {token.name}
          </span>
          <span className="text-[10px] font-mono flex-shrink-0 pf-ticker">
            ${token.ticker}
          </span>
        </div>

        {/* Source badges + age */}
        <div className="flex items-center gap-1 mb-1">
          {isPumpFun && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
          {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
          {isPhantom && <PhantomBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" />}
          <span className="text-[9px] font-mono pf-age">{formatAge(token.created_at)} ago</span>
        </div>

        {/* Description */}
        {token.description && (
          <p className="text-[10px] leading-tight line-clamp-2 pf-desc">
            {token.description}
          </p>
        )}

        {/* CA copy row */}
        {token.mint_address && (
          <button
            onClick={handleCopyCA}
            className="mt-1.5 flex items-center gap-1 w-full text-left group/ca"
          >
            <code className="text-[8px] font-mono text-muted-foreground truncate flex-1">
              {token.mint_address.slice(0, 6)}...{token.mint_address.slice(-4)}
            </code>
            {copiedCA ? (
              <CheckCircle className="h-2.5 w-2.5 text-green-400 flex-shrink-0" />
            ) : (
              <Copy className="h-2.5 w-2.5 text-muted-foreground group-hover/ca:text-foreground flex-shrink-0 transition-colors" />
            )}
          </button>
        )}

        {/* Bonding progress bar */}
        <div className="mt-2 h-1 w-full rounded-pill overflow-hidden pf-progress-bg">
          <div
            className="h-full rounded-pill transition-all duration-300"
            style={{
              width: `${Math.min(token.bonding_progress ?? 0, 100)}%`,
              background: isNearGrad
                ? "linear-gradient(90deg, hsl(24 95% 53%), hsl(16 85% 48%))"
                : "linear-gradient(90deg, hsl(160 84% 39%), hsl(162 95% 24%))",
            }}
          />
        </div>
      </div>
    </Link>
  );
}
