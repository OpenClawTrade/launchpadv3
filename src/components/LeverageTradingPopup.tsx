import { useState, useEffect, memo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import saturnLogo from "@/assets/saturn-logo.png";

const STORAGE_KEY = "saturn_ca_popup_seen_v1";
const TOKEN_CA = "GbMyyLeMy35tjii8Kskicd9ntTSEbtKYFWNKBjVnpump";

export const LeverageTradingPopup = memo(function LeverageTradingPopup() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleClose = () => {
    setOpen(false);
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(TOKEN_CA);
    setCopied(true);
    toast.success("Contract address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[440px] p-0 gap-0 rounded-2xl overflow-hidden border-primary/20"
        style={{ background: "hsl(0 0% 7%)" }}
      >
        {/* Top accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/40 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Icon + Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/30"
              style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.15)" }}
            >
              <img src={saturnLogo} alt="Saturn" className="h-10 w-10 rounded-lg" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-[0.1em] font-mono text-foreground">
                $SATURN is Live
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-[340px]">
                Our native token is now live on Solana. Copy the contract address below to get started.
              </p>
            </div>
          </div>

          {/* CA Section */}
          <div className="bg-secondary/50 rounded-xl p-3 border border-border">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Contract Address</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-foreground break-all leading-relaxed">
                {TOKEN_CA}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            className="w-full py-4 bg-primary hover:bg-primary/90 text-sm sm:text-base font-black uppercase tracking-[0.15em] font-mono"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy Contract Address"}
            <Copy className="h-3.5 w-3.5 ml-2" />
          </Button>

          {/* Dismiss link */}
          <button
            onClick={handleClose}
            className="w-full text-center text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-mono"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
