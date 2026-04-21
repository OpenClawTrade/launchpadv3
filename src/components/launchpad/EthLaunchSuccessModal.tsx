import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Copy, ExternalLink, LineChart, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EthLaunchSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: string;
  txHash?: string | null;
  imageUrl?: string;
  name: string;
  ticker: string;
}

export function EthLaunchSuccessModal({
  open,
  onOpenChange,
  tokenAddress,
  txHash,
  imageUrl,
  name,
  ticker,
}: EthLaunchSuccessModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      toast.success("Contract address copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  };

  const goTrade = () => {
    onOpenChange(false);
    navigate(`/trade/${tokenAddress}`);
  };

  const short = tokenAddress
    ? `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 border-0 bg-transparent shadow-none"
        aria-describedby={undefined}
      >
        <div
          className="bg-pop-cream pop-border p-6"
          style={{ boxShadow: "8px 8px 0 0 hsl(var(--pop-ink))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="font-pop-mono text-[10px] uppercase tracking-[0.18em] bg-pop-ink text-pop-cream px-2 py-1">
              Live
            </span>
            <span className="font-pop-mono text-[10px] uppercase tracking-[0.18em] text-pop-ink/60">
              Ethereum · Uniswap V3
            </span>
          </div>

          <DialogTitle className="font-pop-display text-2xl uppercase text-pop-ink leading-none mb-1">
            🚀 Launched
          </DialogTitle>
          <DialogDescription className="font-pop-mono text-[11px] uppercase text-pop-ink/70 mb-5">
            Your token is live and tradable
          </DialogDescription>

          <div
            className="flex items-center gap-3 bg-pop-orange pop-border p-3 mb-4"
            style={{ boxShadow: "4px 4px 0 0 hsl(var(--pop-ink))" }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="h-14 w-14 object-cover pop-border"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className="h-14 w-14 bg-pop-cream pop-border flex items-center justify-center font-pop-display text-xl text-pop-ink">
                {ticker.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-pop-display text-lg uppercase text-pop-ink leading-tight truncate">
                {name}
              </div>
              <div className="font-pop-mono text-[11px] uppercase text-pop-ink/80">
                ${ticker.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="font-pop-mono text-[10px] uppercase tracking-[0.18em] text-pop-ink/60 mb-1.5">
              Contract Address
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-2 bg-pop-cream pop-border px-3 py-2.5 hover:-translate-y-[1px] transition-transform"
            >
              <span className="font-pop-mono text-[12px] text-pop-ink truncate">
                {tokenAddress}
              </span>
              {copied ? (
                <Check className="h-4 w-4 text-pop-ink shrink-0" strokeWidth={2.5} />
              ) : (
                <Copy className="h-4 w-4 text-pop-ink shrink-0" strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={goTrade}
              className="w-full flex items-center justify-center gap-2 bg-pop-ink text-pop-cream font-pop-display uppercase tracking-tight text-base py-3 pop-border hover:-translate-y-[1px] transition-transform"
              style={{ boxShadow: "5px 5px 0 0 hsl(var(--pop-orange))" }}
            >
              <LineChart className="h-4 w-4" strokeWidth={2.5} />
              Go Trade · See Chart
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`https://etherscan.io/address/${tokenAddress}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 bg-pop-cream pop-border font-pop-mono text-[10px] uppercase tracking-[0.14em] text-pop-ink py-2.5 hover:-translate-y-[1px] transition-transform"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={2.5} />
                Etherscan
              </a>
              {txHash ? (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-pop-cream pop-border font-pop-mono text-[10px] uppercase tracking-[0.14em] text-pop-ink py-2.5 hover:-translate-y-[1px] transition-transform"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={2.5} />
                  Launch Tx
                </a>
              ) : (
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center bg-pop-cream pop-border font-pop-mono text-[10px] uppercase tracking-[0.14em] text-pop-ink py-2.5 hover:-translate-y-[1px] transition-transform"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          {txHash && (
            <p className="font-pop-mono text-[9px] uppercase tracking-[0.16em] text-pop-ink/50 mt-4 truncate">
              tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </p>
          )}
          <p className="font-pop-mono text-[9px] uppercase tracking-[0.16em] text-pop-ink/50 mt-1">
            {short}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
