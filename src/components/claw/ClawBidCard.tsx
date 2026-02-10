import { useState } from "react";
import { Timer, TrendingUp, Gavel } from "lucide-react";
import { useClawBidCountdown } from "@/hooks/useClawBidCountdown";
import { useClawAgentBid } from "@/hooks/useClawAgentBid";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface ClawBidCardProps {
  tradingAgentId: string;
  agentName: string;
  biddingEndsAt: string | null;
  isOwned: boolean;
  ownerWallet?: string | null;
  walletAddress?: string | null;
}

export function ClawBidCard({ tradingAgentId, agentName, biddingEndsAt, isOwned, ownerWallet, walletAddress }: ClawBidCardProps) {
  const [bidAmount, setBidAmount] = useState("");
  const { timeLeft, isExpired } = useClawBidCountdown(biddingEndsAt);
  const { bidStatus, isPlacingBid, placeBid } = useClawAgentBid(tradingAgentId);

  const handleBid = async () => {
    if (!walletAddress) {
      toast({ title: "Connect wallet to bid", variant: "destructive" });
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid SOL amount", variant: "destructive" });
      return;
    }

    try {
      await placeBid({ tradingAgentId, bidderWallet: walletAddress, bidAmountSol: amount });
      toast({ title: "🦞 Bid Placed!", description: `${amount} SOL on ${agentName}` });
      setBidAmount("");
    } catch (e) {
      toast({ title: "Bid failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isOwned) {
    return (
      <div className="p-2 rounded-lg" style={{ background: "hsl(142, 71%, 45%, 0.1)", border: "1px solid hsl(142, 71%, 45%, 0.3)" }}>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" style={{ color: "hsl(142, 71%, 45%)" }} />
          <span className="text-[10px] font-bold" style={{ color: "hsl(142, 71%, 45%)" }}>OWNED</span>
        </div>
        <p className="text-[9px] mt-0.5 truncate" style={{ color: "hsl(var(--claw-muted))" }}>
          {ownerWallet ? `${ownerWallet.slice(0, 4)}...${ownerWallet.slice(-4)}` : "Unknown"}
        </p>
      </div>
    );
  }

  if (!biddingEndsAt || isExpired) {
    return (
      <div className="p-2 rounded-lg" style={{ background: "hsl(var(--claw-bg))", border: "1px solid hsl(var(--claw-border))" }}>
        <span className="text-[10px]" style={{ color: "hsl(var(--claw-muted))" }}>Bidding ended</span>
      </div>
    );
  }

  const highestBid = bidStatus?.highestBid?.amount || 0;

  return (
    <div className="p-2.5 rounded-lg" style={{ background: "hsl(var(--claw-primary) / 0.05)", border: "1px solid hsl(var(--claw-primary) / 0.3)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Gavel className="h-3 w-3" style={{ color: "hsl(var(--claw-primary))" }} />
          <span className="text-[10px] font-bold" style={{ color: "hsl(var(--claw-primary))" }}>BIDDING OPEN</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3" style={{ color: "hsl(var(--claw-accent))" }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: "hsl(var(--claw-accent))" }}>{timeLeft}</span>
        </div>
      </div>

      {highestBid > 0 && (
        <div className="mb-2 text-[10px]" style={{ color: "hsl(var(--claw-muted))" }}>
          Highest: <span className="font-bold" style={{ color: "hsl(var(--claw-text))" }}>{highestBid} SOL</span>
          {bidStatus?.totalBids > 0 && <span> ({bidStatus.totalBids} bids)</span>}
        </div>
      )}

      <div className="flex gap-1.5">
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder={highestBid > 0 ? `>${highestBid}` : "SOL"}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="h-7 text-xs flex-1"
          style={{ background: "hsl(var(--claw-bg))", borderColor: "hsl(var(--claw-border))", color: "hsl(var(--claw-text))" }}
        />
        <button
          onClick={handleBid}
          disabled={isPlacingBid || !bidAmount}
          className="px-3 h-7 rounded text-[10px] font-bold disabled:opacity-40"
          style={{ background: "hsl(var(--claw-primary))", color: "#000" }}
        >
          {isPlacingBid ? "..." : "BID 🦞"}
        </button>
      </div>
    </div>
  );
}
