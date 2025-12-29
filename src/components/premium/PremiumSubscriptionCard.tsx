import { useState } from "react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const RECEIVER_WALLET = "tmwZ3GmxNGZA8AyEcxn6W44X5jhH8uxmT5oomD7dK5r";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

// Price in USD
const BLUE_PRICE_USD = 10;
const GOLD_PRICE_USD = 100;

// Approximate SOL price (in production, fetch from oracle)
const SOL_PRICE_USD = 200;

const BLUE_PRICE_SOL = BLUE_PRICE_USD / SOL_PRICE_USD;
const GOLD_PRICE_SOL = GOLD_PRICE_USD / SOL_PRICE_USD;

interface PlanOption {
  type: "blue" | "gold";
  name: string;
  priceUsd: number;
  priceSol: number;
  features: string[];
}

const plans: PlanOption[] = [
  {
    type: "blue",
    name: "Blue Verified",
    priceUsd: BLUE_PRICE_USD,
    priceSol: BLUE_PRICE_SOL,
    features: [
      "Blue verification badge",
      "Priority in replies",
      "Longer posts",
      "Edit posts",
    ],
  },
  {
    type: "gold",
    name: "Gold Verified",
    priceUsd: GOLD_PRICE_USD,
    priceSol: GOLD_PRICE_SOL,
    features: [
      "Gold verification badge",
      "All Blue features",
      "Top of search results",
      "Premium support",
      "Exclusive access to new features",
    ],
  },
];

export function PremiumSubscriptionCard() {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);

  const handleSubscribeClick = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    setIsModalOpen(true);
  };

  const handlePurchase = async (plan: PlanOption) => {
    if (!solanaAddress || wallets.length === 0) {
      toast.error("Please connect a Solana wallet first");
      return;
    }

    setSelectedPlan(plan);
    setIsProcessing(true);

    try {
      const wallet = wallets[0];
      const connection = new Connection(SOLANA_RPC, "confirmed");
      
      const fromPubkey = new PublicKey(solanaAddress);
      const toPubkey = new PublicKey(RECEIVER_WALLET);
      const lamports = Math.round(plan.priceSol * LAMPORTS_PER_SOL);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Serialize transaction for Privy
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // Sign and send transaction using Privy wallet
      const result = await signAndSendTransaction({
        transaction: serializedTransaction,
        wallet,
      });

      console.log("Transaction sent:", result);

      // Update user's verified status in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ verified_type: plan.type })
          .eq("id", user.id);
      }

      toast.success(`Successfully purchased ${plan.name}!`);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Payment failed:", error);
      if (error.message?.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Payment failed. Please try again.");
      }
    } finally {
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  return (
    <>
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Subscribe to Premium</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-3">
          Get verified with SOL payments. Unlock exclusive features and boost your presence.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <VerifiedBadge type="blue" className="h-4 w-4" />
          <span className="text-xs text-muted-foreground">${BLUE_PRICE_USD}/one-time</span>
          <span className="text-muted-foreground">·</span>
          <VerifiedBadge type="gold" className="h-4 w-4" />
          <span className="text-xs text-muted-foreground">${GOLD_PRICE_USD}/one-time</span>
        </div>
        <Button 
          onClick={handleSubscribeClick}
          className="rounded-lg font-semibold text-sm h-9 w-full"
        >
          Get Verified
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Choose Your Plan
            </DialogTitle>
            <DialogDescription>
              Pay with SOL to get verified instantly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {plans.map((plan) => (
              <div
                key={plan.type}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  plan.type === "gold" 
                    ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-500" 
                    : "border-blue-500/50 bg-blue-500/5 hover:border-blue-500"
                }`}
                onClick={() => !isProcessing && handlePurchase(plan)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <VerifiedBadge type={plan.type} className="h-5 w-5" />
                    <span className="font-semibold">{plan.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${plan.priceUsd}</div>
                    <div className="text-xs text-muted-foreground">
                      ~{plan.priceSol.toFixed(4)} SOL
                    </div>
                  </div>
                </div>
                <ul className="space-y-1 mt-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isProcessing && selectedPlan?.type === plan.type && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing payment...
                  </div>
                )}
              </div>
            ))}
          </div>

          {!solanaAddress && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              A Solana wallet is required to complete payment
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
