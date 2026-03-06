import { memo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Link2, Zap, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NotLoggedInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotLoggedInModal = memo(function NotLoggedInModal({ open, onOpenChange }: NotLoggedInModalProps) {
  const { login } = useAuth();

  const handleConnect = () => {
    onOpenChange(false);
    login();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] p-0 gap-0 border-border/40 rounded-2xl overflow-hidden bg-card/95 backdrop-blur-xl">
        {/* Top accent line */}
        <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, hsl(50 80% 35%), hsl(50 80% 35%), transparent)" }} />

        <div className="p-6 space-y-5">
          {/* Icon + Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "hsl(50 80% 35% / 0.12)", border: "1px solid hsl(50 80% 35% / 0.25)" }}>
              <Link2 className="h-5 w-5" style={{ color: "hsl(50 80% 35%)" }} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.15em] font-mono text-foreground">
              Connect to Trade
            </h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground max-w-[280px]">
              Log in to start trading tokens instantly with one-click quick buy
            </p>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {[
              { icon: Zap, text: "One-click quick buy with preset amounts" },
              { icon: Shield, text: "Secure embedded wallet — no extensions needed" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(50 80% 35%)" }} />
                <span className="text-[10px] font-medium text-foreground/70">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] font-mono transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, hsl(50 80% 35%), hsl(45 75% 30%))",
              color: "hsl(0 0% 100%)",
              boxShadow: "0 4px 20px hsl(50 80% 35% / 0.25), inset 0 1px 0 hsl(50 80% 50% / 0.2)",
            }}
          >
            Connect Wallet
          </button>

          {/* Terms */}
          <p className="text-[9px] text-center text-muted-foreground/40 leading-relaxed">
            By connecting, you agree to the Terms of Service and acknowledge the risks of trading digital assets.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
