import { useState } from "react";
import { X, Copy, Check, Rocket, Shield, Zap, Globe } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLE_TEXT = "@clawmode !clawmode a meme coin about a dancing lobster";

export function CreateTokenModal({ open, onClose }: CreateTokenModalProps) {
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();

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
          "relative z-10 w-full flex flex-col overflow-hidden",
          "animate-in fade-in duration-200",
          // Mobile: bottom sheet
          "max-h-[90dvh] rounded-t-[24px] md:rounded-[24px]",
          // Desktop: centered card
          "md:max-w-[540px] md:mx-auto md:max-h-[85vh]",
        )}
        style={{
          background: "linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(10,14,26,0.99) 100%)",
          border: "1px solid rgba(51,65,85,0.5)",
          boxShadow: "0 0 80px rgba(0,0,0,0.6), 0 0 40px rgba(249,115,22,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 md:px-10 pt-4 md:pt-8 pb-2">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
            >
              <Rocket className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[#F1F5F9] tracking-tight">
                Launch Token
              </h2>
              <p className="text-[11px] md:text-xs text-[#64748B] font-medium">via X (Twitter)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 md:w-8 md:h-8 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#94A3B8]" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-5 md:py-6 space-y-5 md:space-y-6">
          {/* Intro */}
          <p className="text-[14px] md:text-[15px] text-[#CBD5E1] leading-relaxed">
            Launch your token right from{" "}
            <span className="text-[#F1F5F9] font-semibold">X (Twitter)</span> with a simple reply to any post. No forms, no friction.
          </p>

          {/* Steps */}
          <div className="space-y-4">
            <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.15em] text-[#64748B]">
              How it works
            </p>

            {/* Step 1 */}
            <div className="flex items-start gap-3 md:gap-4">
              <StepNumber n={1} />
              <div className="flex-1 pt-0.5">
                <p className="text-[13px] md:text-[14px] font-medium text-[#E2E8F0]">
                  Reply to any post on X with:
                </p>
                {/* Code block */}
                <div
                  className="mt-2.5 rounded-xl px-4 py-3 md:px-5 md:py-3.5 font-mono text-[12px] md:text-[13px] relative group"
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    border: "1px solid rgba(51,65,85,0.6)",
                  }}
                >
                  <span className="text-[#F97316] font-semibold">@clawmode</span>{" "}
                  <span className="text-[#64748B]">!clawmode</span>{" "}
                  <span className="text-[#94A3B8] italic">describe what you want to launch</span>

                  <button
                    onClick={handleCopy}
                    className={cn(
                      "absolute top-2 right-2 flex items-center justify-center w-8 h-8 md:w-7 md:h-7 rounded-lg transition-all",
                      copied
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-[#64748B] hover:bg-white/10 hover:text-[#94A3B8]"
                    )}
                    aria-label="Copy"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 md:gap-4">
              <StepNumber n={2} />
              <p className="text-[13px] md:text-[14px] text-[#CBD5E1] pt-0.5">
                Our AI generates the name, ticker, description & avatar automatically
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 md:gap-4">
              <StepNumber n={3} />
              <p className="text-[13px] md:text-[14px] text-[#CBD5E1] pt-0.5">
                Token deploys instantly on Solana — you'll get a reply with the link
              </p>
            </div>
          </div>

          {/* Example */}
          <div
            className="rounded-xl px-4 py-3 md:px-5 md:py-3.5"
            style={{
              background: "rgba(249,115,22,0.04)",
              border: "1px solid rgba(249,115,22,0.12)",
            }}
          >
            <p className="text-[11px] md:text-[12px] font-mono text-[#94A3B8]">
              <span className="text-[#64748B]">Example:</span>{" "}
              <span className="text-[#F97316]">@clawmode !clawmode</span>{" "}
              <span className="text-[#CBD5E1]">a meme coin about a dancing lobster</span>
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-2">
            <TrustBadge icon={<Globe className="w-3 h-3" />} label="Powered by Solana" />
            <TrustBadge icon={<Zap className="w-3 h-3" />} label="Instant Deploy" />
            <TrustBadge icon={<Shield className="w-3 h-3" />} label="Secure" />
          </div>
        </div>

        {/* CTA — sticky bottom */}
        <div className="px-6 md:px-10 pb-6 md:pb-8 pt-3">
          <a
            href="https://x.com/clawmode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 md:py-4 rounded-2xl text-[14px] md:text-[15px] font-bold text-white transition-all active:scale-[0.98] hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: "0 4px 20px rgba(249,115,22,0.3)",
            }}
          >
            Go to @clawmode on X
            <span className="text-white/80">→</span>
          </a>

          <p className="text-[10px] text-[#475569] text-center mt-3 leading-relaxed">
            Tokens are launched on Solana mainnet. Trading fees apply. DYOR.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div
      className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full flex-shrink-0 text-[11px] md:text-[12px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
    >
      {String(n).padStart(2, "0")}
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] md:text-[11px] font-medium text-[#94A3B8]"
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
