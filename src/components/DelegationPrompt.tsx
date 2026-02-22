import { useState } from "react";
import { useDelegatedWallet } from "@/hooks/useDelegatedWallet";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Shield, X } from "lucide-react";

export function DelegationPrompt() {
  const privyAvailable = usePrivyAvailable();
  const { isAuthenticated } = useAuth();

  if (!privyAvailable || !isAuthenticated) return null;

  return <DelegationPromptInner />;
}

function DelegationPromptInner() {
  const { needsDelegation, isDelegating, requestDelegation, dismiss } =
    useDelegatedWallet();
  const [error, setError] = useState<string | null>(null);

  if (!needsDelegation) return null;

  const handleEnable = async () => {
    setError(null);
    try {
      await requestDelegation();
    } catch (e: any) {
      console.error("Delegation failed:", e);
      setError(e?.message || "Failed to enable auto-trading");
    }
  };

  return (
    <Dialog open={needsDelegation} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md border-border bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="h-5 w-5 text-success" />
            Enable One-Click Trading
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Trade instantly on Terminal mode without extra approvals. Your wallet stays secure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
            <Zap className="h-4 w-4 mt-0.5 text-success flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Instant trades</p>
              <p className="text-xs text-muted-foreground">
                Buy and sell with a single click — no wallet popups
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
            <Shield className="h-4 w-4 mt-0.5 text-accent-blue flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Secure & revocable</p>
              <p className="text-xs text-muted-foreground">
                You stay in full control. Revoke access anytime from settings.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={dismiss}
            disabled={isDelegating}
          >
            Maybe Later
          </Button>
          <Button
            className="flex-1 btn-gradient-green text-white"
            onClick={handleEnable}
            disabled={isDelegating}
          >
            {isDelegating ? "Enabling..." : "Enable Auto-Trading"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
