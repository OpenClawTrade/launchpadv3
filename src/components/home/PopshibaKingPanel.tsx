import { Link } from "react-router-dom";
import { Crown, Rocket } from "lucide-react";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { useSolPrice } from "@/hooks/useSolPrice";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

function fmtUsd(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function PopshibaKingPanel() {
  const { tokens } = useKingOfTheHill();
  const king = tokens && tokens.length > 0 ? tokens[0] : null;
  const { solPrice } = useSolPrice();

  return (
    <div className="border-2 border-pop-ink bg-white shadow-[6px_6px_0_hsl(var(--pop-ink))]">
      {/* head bar */}
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b-2 border-pop-ink bg-pop-orange">
        <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-pop-ink bg-pop-ink text-pop-orange flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-pop-display text-[16px] sm:text-[20px] text-pop-ink tracking-[-0.02em] truncate">
            KING OF THE HILL
          </div>
          <div className="font-pop-mono text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-[#3a1f14] mt-0.5">
            SOON TO GRADUATE
          </div>
        </div>
        {king && (
          <span className="hidden sm:inline-flex font-pop-mono text-[12px] bg-pop-ink text-pop-orange px-3 py-1.5 font-bold tracking-[0.1em] whitespace-nowrap shrink-0">
            ◆ {((king.market_cap_sol ?? 0) * (solPrice || 0) / 1000).toFixed(1)}K
          </span>
        )}
        <Link
          to="/launchpad"
          className="hidden sm:inline-flex items-center gap-2 font-bold text-[11px] px-3 py-1.5 border-2 border-pop-ink bg-pop-ink text-pop-cream shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-transform shrink-0"
        >
          FullBoard →
        </Link>
      </div>

      {/* throne */}
      <div
        className="px-5 sm:px-10 py-12 sm:py-16 lg:py-20 text-center"
        style={{
          background:
            "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(245,165,36,0.08) 14px 15px), #fff",
        }}
      >
        {king ? (
          <>
            <div className="flex justify-center mb-4 sm:mb-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 border-[3px] border-pop-ink rounded-full overflow-hidden bg-pop-cream">
                <OptimizedTokenImage
                  src={king.image_url}
                  fallbackText={king.ticker}
                  alt={king.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3
              className="font-pop-display text-pop-ink leading-[0.95] tracking-[-0.03em] mb-2 sm:mb-3"
              style={{ fontSize: "clamp(32px, 6vw, 56px)" }}
            >
              {king.name?.toUpperCase()}
            </h3>
            <p className="text-[#3a1f14] text-[14px] sm:text-[15px] max-w-md mx-auto mb-6">
              ${king.ticker} · {fmtUsd((king.market_cap_sol ?? 0) * (solPrice || 0))} marketcap · the loudest bark on Popshiba.
            </p>
            <Link
              to={`/trade/${king.mint_address || king.id}`}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-pop-orange border-2 border-pop-ink text-pop-ink font-bold text-[14px] sm:text-[15px] shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all"
            >
              ◆ Trade the king →
            </Link>
          </>
        ) : (
          <>
            <div className="text-pop-orange mb-4 sm:mb-5 flex justify-center">
              <Crown className="w-14 h-14 sm:w-16 sm:h-16" strokeWidth={2.5} />
            </div>
            <h3
              className="font-pop-display text-pop-ink leading-[0.95] tracking-[-0.03em] mb-2 sm:mb-3"
              style={{ fontSize: "clamp(32px, 6vw, 56px)" }}
            >
              THE THRONE IS EMPTY
            </h3>
            <p className="text-[#3a1f14] text-[14px] sm:text-[15px] max-w-md mx-auto mb-6">
              Be the first to launch a Popshiba token on ETH and claim the crown.
            </p>
            <Link
              to="/launch"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-pop-orange border-2 border-pop-ink text-pop-ink font-bold text-[14px] sm:text-[15px] shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all"
            >
              <Rocket className="w-4 h-4" /> Launch the first king →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
