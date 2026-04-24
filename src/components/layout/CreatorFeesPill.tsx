// Always-visible nav pill showing total claimable WETH across all tokens
// the connected wallet has launched. One-click batch claim.
import { useState } from "react";
import { useAccount } from "wagmi";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClaimableCreatorFees } from "@/hooks/useClaimableCreatorFees";

export function CreatorFeesPill() {
  // useAccount throws if no WagmiProvider is mounted on this route (e.g. the
  // standalone /popv4instant/deploy admin console). Swallow that case so the
  // pill simply hides instead of crashing the whole page.
  let address: `0x${string}` | undefined;
  try {
    address = useAccount().address;
  } catch {
    return null;
  }
  const { totalEth, totalWei, tokens, refetch } = useClaimableCreatorFees(address);
  const [claiming, setClaiming] = useState(false);

  if (!address || totalWei === 0n) return null;

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    let claimed = 0;
    let failed = 0;
    try {
      // Sequential to avoid nonce collisions in the deployer wallet
      for (const t of tokens) {
        try {
          const { data, error } = await supabase.functions.invoke("eth-claim-creator-fees", {
            body: { tokenAddress: t.token_address, creatorWallet: address },
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || "Claim failed");
          claimed++;
        } catch (e) {
          console.error("[CreatorFeesPill] claim failed for", t.token_address, e);
          failed++;
        }
      }
      if (claimed > 0) {
        toast.success(`Claimed ${claimed} ${claimed === 1 ? "token" : "tokens"}`, {
          description: failed > 0 ? `${failed} failed — try again later` : `${totalEth} ETH sent to ${address.slice(0, 6)}…${address.slice(-4)}`,
        });
      } else if (failed > 0) {
        toast.error("Claim failed", { description: "All claims failed. Try again shortly." });
      }
      await refetch();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <button
      onClick={handleClaim}
      disabled={claiming}
      title={`Claim creator fees from ${tokens.length} ${tokens.length === 1 ? "token" : "tokens"}`}
      className="inline-flex items-center gap-1.5 font-bold text-[11px] sm:text-[12px] px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 border-pop-ink bg-pop-cream text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-60"
    >
      {claiming
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Coins className="w-3.5 h-3.5 text-pop-orange" />}
      <span className="tabular-nums">${parseFloat(totalEth).toFixed(4)} ETH</span>
      <span className="hidden sm:inline opacity-70">claimable</span>
    </button>
  );
}
