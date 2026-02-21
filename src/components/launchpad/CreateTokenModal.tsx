import { useState, useEffect } from "react";
import { X, Copy, Check, Rocket, Shield, Zap, Globe, Clock, Sparkles } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLE_TEXT = "@clawmode !clawmode a meme coin about a dancing lobster";
const HALT_UNTIL = new Date("2026-02-22T11:40:00Z");

function useCountdown(targetDate: Date) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetDate.getTime() - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      setRemaining(diff);
      if (diff <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return { hours, minutes, seconds, isActive: remaining > 0 };
}

export function CreateTokenModal({ open, onClose }: CreateTokenModalProps) {
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();
  const countdown = useCountdown(HALT_UNTIL);

  if (!open) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(EXAMPLE_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

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
          "max-h-[88dvh] rounded-t-[28px] md:rounded-[24px]",
          "md:max-w-[540px] md:mx-auto md:max-h-[85vh]",
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
        <div className="flex items-center justify-between px-5 md:px-10 pt-3 md:pt-8 pb-3 md:pb-2">
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-2xl md:rounded-xl"
              style={{ background: countdown.isActive ? "linear-gradient(135deg, #64748B, #475569)" : "linear-gradient(135deg, #F97316, #EA580C)" }}
            >
              {countdown.isActive ? (
                <Clock className="w-5 h-5 md:w-5 md:h-5 text-white" />
              ) : (
                <Rocket className="w-5 h-5 md:w-5 md:h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-[22px] md:text-xl font-bold text-[#F1F5F9] tracking-tight leading-tight">
                {countdown.isActive ? "Launching Soon" : "Launch Token"}
              </h2>
              <p className="text-xs md:text-xs text-[#64748B] font-medium mt-0.5">
                {countdown.isActive ? "Temporarily paused" : "via X (Twitter)"}
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
        <div className="flex-1 overflow-y-auto px-5 md:px-10 py-4 md:py-6 space-y-5 md:space-y-5">

          {/* Countdown Banner */}
          {countdown.isActive && (
            <div
              className="rounded-2xl md:rounded-xl p-5 md:p-5 text-center space-y-4"
              style={{
                background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.04))",
                border: "1px solid rgba(249,115,22,0.2)",
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#F97316]" />
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#F97316]">
                  Resumes In
                </p>
              </div>

              {/* Timer digits */}
              <div className="flex items-center justify-center gap-3">
                <TimeUnit value={countdown.hours} label="HRS" />
                <span className="text-2xl font-bold text-[#475569] -mt-4">:</span>
                <TimeUnit value={countdown.minutes} label="MIN" />
                <span className="text-2xl font-bold text-[#475569] -mt-4">:</span>
                <TimeUnit value={countdown.seconds} label="SEC" />
              </div>

              <p className="text-[13px] text-[#94A3B8] leading-relaxed">
                Token creation is temporarily paused while we prepare for our next phase.
              </p>
            </div>
          )}

          {/* NFA Announcement */}
          <div
            className="rounded-2xl md:rounded-xl p-5 md:p-5 space-y-3"
            style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(139,92,246,0.06))",
              border: "1px solid rgba(34,211,238,0.15)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ background: "linear-gradient(135deg, #22D3EE, #8B5CF6)" }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#F1F5F9]">
                  NFA — Non-Fungible Agents
                </p>
                <p className="text-[11px] text-[#64748B] font-medium">Coming Next</p>
              </div>
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-[1.65]">
              We're preparing for the launch of{" "}
              <span className="text-[#22D3EE] font-semibold">Non-Fungible Agents (NFAs)</span> — 
              1,000 unique AI agents minted as NFTs on Solana. Each NFA owns its own token, 
              earns trading fees, and can be traded as a complete on-chain business.
            </p>
            <p className="text-[13px] text-[#94A3B8] leading-[1.65]">
              Once NFAs launch, the native token creation feature will resume with enhanced capabilities 
              powered by the NFA ecosystem.
            </p>
          </div>

          {/* Steps — show only when not halted */}
          {!countdown.isActive && (
            <>
              <div className="space-y-0">
                <p className="text-xs md:text-[11px] font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-5 md:mb-4">
                  How it works
                </p>

                {/* Step 1 */}
                <div className="flex items-start gap-4 md:gap-4">
                  <StepNumber n={1} />
                  <div className="flex-1 pt-1">
                    <p className="text-[15px] md:text-[14px] font-medium leading-snug text-[#E2E8F0]">
                      Reply to any post on X with:
                    </p>
                    <div
                      className="mt-3 rounded-2xl md:rounded-xl px-4 py-4 md:px-5 md:py-3.5 font-mono text-[13px] md:text-[13px] relative"
                      style={{
                        background: "rgba(15,23,42,0.9)",
                        border: "1px solid rgba(51,65,85,0.6)",
                      }}
                    >
                      <div className="pr-10">
                        <span className="text-[#F97316] font-semibold">@clawmode</span>{" "}
                        <span className="text-[#64748B]">!clawmode</span>
                        <br className="sm:hidden" />
                        <span className="text-[#94A3B8] italic"> describe what you want to launch</span>
                      </div>

                      <button
                        onClick={handleCopy}
                        className={cn(
                          "absolute top-3 right-3 flex items-center justify-center w-10 h-10 md:w-7 md:h-7 rounded-xl md:rounded-lg transition-all active:scale-90",
                          copied
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/8 text-[#64748B] hover:bg-white/10 hover:text-[#94A3B8]"
                        )}
                        aria-label="Copy command"
                      >
                        {copied ? <Check className="w-4 h-4 md:w-3.5 md:h-3.5" /> : <Copy className="w-4 h-4 md:w-3.5 md:h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-5 md:h-4" />

                {/* Step 2 */}
                <div className="flex items-start gap-4 md:gap-4">
                  <StepNumber n={2} />
                  <p className="text-[15px] md:text-[14px] pt-1 leading-[1.55] text-[#CBD5E1]">
                    Our AI generates the name, ticker, description & avatar automatically
                  </p>
                </div>

                <div className="h-5 md:h-4" />

                {/* Step 3 */}
                <div className="flex items-start gap-4 md:gap-4">
                  <StepNumber n={3} />
                  <p className="text-[15px] md:text-[14px] pt-1 leading-[1.55] text-[#CBD5E1]">
                    Token deploys instantly on Solana — you'll get a reply with the link
                  </p>
                </div>
              </div>

              {/* Example */}
              <div
                className="rounded-2xl md:rounded-xl px-4 py-3.5 md:px-5 md:py-3.5"
                style={{
                  background: "rgba(249,115,22,0.05)",
                  border: "1px solid rgba(249,115,22,0.12)",
                }}
              >
                <p className="text-[12px] md:text-[12px] font-mono text-[#94A3B8] leading-relaxed">
                  <span className="text-[#64748B]">Example:</span>{" "}
                  <span className="text-[#F97316]">@clawmode !clawmode</span>{" "}
                  <span className="text-[#CBD5E1]">a meme coin about a dancing lobster</span>
                </p>
              </div>
            </>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap gap-2.5 md:gap-2">
            <TrustBadge icon={<Globe className="w-3.5 h-3.5 md:w-3 md:h-3" />} label="Powered by Solana" />
            <TrustBadge icon={<Zap className="w-3.5 h-3.5 md:w-3 md:h-3" />} label="Instant Deploy" />
            <TrustBadge icon={<Shield className="w-3.5 h-3.5 md:w-3 md:h-3" />} label="Secure" />
          </div>
        </div>

        {/* CTA — sticky bottom */}
        <div className="px-5 md:px-10 pb-7 md:pb-8 pt-3">
          <a
            href="https://x.com/clawmode"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center gap-2.5 w-full py-4 md:py-4 rounded-2xl text-[16px] md:text-[15px] font-bold text-white transition-all active:scale-[0.97] hover:shadow-lg",
              countdown.isActive && "opacity-60 pointer-events-none"
            )}
            style={{
              background: countdown.isActive 
                ? "linear-gradient(135deg, #475569, #334155)" 
                : "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: countdown.isActive 
                ? "none" 
                : "0 6px 24px rgba(249,115,22,0.35)",
              minHeight: "54px",
            }}
          >
            {countdown.isActive ? "Paused — Resuming Soon" : "Go to @clawmode on X"}
            {!countdown.isActive && <span className="text-white/80">→</span>}
          </a>

          <p className="text-[10px] text-[#475569] text-center mt-3.5 leading-relaxed">
            Tokens are launched on Solana mainnet. Trading fees apply. DYOR.
          </p>
        </div>
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-16 h-16 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl md:text-xl font-mono font-bold text-[#F1F5F9]"
        style={{
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(249,115,22,0.2)",
        }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <p className="text-[9px] font-semibold tracking-wider text-[#64748B] mt-1.5">{label}</p>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div
      className="flex items-center justify-center w-10 h-10 md:w-8 md:h-8 rounded-full flex-shrink-0 text-[13px] md:text-[12px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
    >
      {String(n).padStart(2, "0")}
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2 md:gap-1.5 px-3.5 md:px-3 py-2 md:py-1.5 rounded-full text-[11px] md:text-[11px] font-medium text-[#94A3B8]"
      style={{
        background: "rgba(51,65,85,0.2)",
        border: "1px solid rgba(51,65,85,0.4)",
      }}
    >
      <span className="text-[#22D3EE]">{icon}</span>
      {label}
    </div>
  );
}
