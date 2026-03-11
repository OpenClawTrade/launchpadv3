import { useState } from "react";
import { X, Rocket, ExternalLink, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
}

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  solscanUrl?: string;
  tradeUrl?: string;
}

export function CreateTokenModal({ open, onClose }: CreateTokenModalProps) {
  const isMobile = useIsMobile();
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleReset = () => setLastResult(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-[95%] md:w-full flex flex-col overflow-hidden",
          "animate-in slide-in-from-bottom-4 md:fade-in duration-300 md:duration-200",
          "max-h-[90dvh] rounded-t-[28px] md:rounded-[24px]",
          "md:max-w-[600px] md:mx-auto",
        )}
        style={{
          background: "linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(10,14,26,0.99) 100%)",
          border: "1px solid rgba(51,65,85,0.5)",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.5), 0 0 40px rgba(249,115,22,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 md:px-8 pt-3 md:pt-6 pb-3 md:pb-2">
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-2xl md:rounded-xl"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
            >
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[22px] md:text-xl font-bold text-[#F1F5F9] tracking-tight leading-tight">
                Launch Token
              </h2>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">
                via Phantom Wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 rounded-2xl md:rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5 md:w-4 md:h-4 text-[#94A3B8]" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-4 md:py-5">
          {lastResult?.success && lastResult.mintAddress ? (
            <SuccessResult result={lastResult} onReset={handleReset} onClose={onClose} />
          ) : (
            <TokenLauncher
              bare
              defaultMode="phantom"
              onLaunchSuccess={() => {}}
              onShowResult={(result) => setLastResult(result as LaunchResult)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessResult({
  result,
  onReset,
  onClose,
}: {
  result: LaunchResult;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5 animate-in fade-in duration-400">
      {/* Token card */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.25)",
          boxShadow: "0 0 24px rgba(16,185,129,0.08)",
        }}
      >
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={result.name}
            className="w-14 h-14 rounded-xl object-cover ring-2 ring-emerald-500/30"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-emerald-300 tracking-tight">
            {result.name} (${result.ticker}) launched! 🚀
          </p>
          <p className="text-[11px] text-[#64748B] font-mono truncate mt-1">
            {result.mintAddress}
          </p>
        </div>
      </div>

      {/* Action links */}
      <div className="flex gap-3">
        {result.solscanUrl && (
          <a
            href={result.solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}
          >
            Solscan <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {result.tradeUrl && (
          <a
            href={result.tradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{
              color: "#fb923c",
              background: "rgba(249,115,22,0.08)",
              border: "1px solid rgba(249,115,22,0.2)",
            }}
          >
            Trade <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 6px 24px rgba(249,115,22,0.3)" }}
        >
          Launch Another
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium text-[#94A3B8] bg-white/5 hover:bg-white/10 transition-all active:scale-[0.97]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
