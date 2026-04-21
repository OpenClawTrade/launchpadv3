import { useState, memo } from "react";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";

export const LeverageTradingBanner = memo(function LeverageTradingBanner() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-pop-ink text-pop-cream pop-border transition-transform active:translate-x-[1px] active:translate-y-[1px] hover:-translate-x-[1px] hover:-translate-y-[1px]"
        style={{ boxShadow: "5px 5px 0 0 hsl(var(--pop-cream)), 5px 5px 0 2px hsl(var(--pop-ink))" }}
      >
        <div className="h-9 w-9 flex items-center justify-center bg-pop-orange text-pop-ink pop-border shrink-0 font-pop-display text-sm" style={{ boxShadow: "2px 2px 0 0 hsl(var(--pop-cream))" }}>
          ↗
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-pop-display text-[15px] tracking-tight leading-tight">
            Leverage trade up to <span className="text-pop-orange">80×</span>
          </p>
          <p className="font-pop-mono text-[10px] uppercase tracking-[0.12em] text-pop-cream/60 mt-0.5 truncate">
            Advanced tools · Deep liquidity · No order-book slip
          </p>
        </div>
        <span className="font-pop-mono text-[11px] font-bold uppercase tracking-[0.18em] text-pop-orange shrink-0 px-3 py-2 border border-dashed border-pop-orange">
          Start →
        </span>
      </button>
      <NotLoggedInModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
});
