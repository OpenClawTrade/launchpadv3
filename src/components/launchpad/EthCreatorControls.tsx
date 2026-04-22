// ============================================================================
// EthCreatorControls (V3 — fee-claim flavor)
//
// Replaces V2 burn/remove/renounce. The platform owns the LP NFT, so the
// creator has nothing to manage on-chain. This panel shows their accrued
// 50% share of the 1% Uniswap V3 trading fees and lets them claim.
//
// Used on:
//   - Launch success screen (embedded=true)
//   - /trade/:address page (auto-detects creator by matching wallet)
// ============================================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Coins, Loader2, ExternalLink, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatEther } from "viem";

interface Props {
  tokenAddress: string;
  embedded?: boolean;
}

interface Ledger {
  creator_wallet: string;
  creator_share_weth: string;
  creator_paid_weth: string;
  total_collected_weth: string;
  last_claim_at: string | null;
  last_claim_tx: string | null;
}

export function EthCreatorControls({ tokenAddress, embedded = false }: Props) {
  const { address: connected } = useAccount();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("eth_creator_fee_ledger")
      .select("creator_wallet,creator_share_weth,creator_paid_weth,total_collected_weth,last_claim_at,last_claim_tx")
      .eq("token_address", tokenAddress.toLowerCase())
      .maybeSingle();
    setLedger((data as any) ?? null);
    setLoading(false);
  }, [tokenAddress]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const isCreator = !!ledger && !!connected && ledger.creator_wallet.toLowerCase() === connected.toLowerCase();

  const { totalEarnedEth, claimableEth, lifetimeEth } = useMemo(() => {
    if (!ledger) return { totalEarnedEth: "0", claimableEth: "0", lifetimeEth: "0" };
    try {
      const share = BigInt(ledger.creator_share_weth || "0");
      const paid = BigInt(ledger.creator_paid_weth || "0");
      const total = BigInt(ledger.total_collected_weth || "0");
      const owed = share > paid ? share - paid : 0n;
      return {
        totalEarnedEth: parseFloat(formatEther(share)).toFixed(6),
        claimableEth: parseFloat(formatEther(owed)).toFixed(6),
        lifetimeEth: parseFloat(formatEther(total)).toFixed(6),
      };
    } catch {
      return { totalEarnedEth: "0", claimableEth: "0", lifetimeEth: "0" };
    }
  }, [ledger]);

  const handleClaim = async () => {
    if (!isCreator || !connected) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke("eth-claim-creator-fees", {
        body: { tokenAddress, creatorWallet: connected },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Claim failed");
      toast.success("✅ Fees claimed", {
        description: `${parseFloat(formatEther(BigInt(data.claimedWeth))).toFixed(6)} ${data.mode === "eth" ? "ETH" : "WETH"} sent`,
        action: data.txHash ? {
          label: "Etherscan",
          onClick: () => window.open(`https://etherscan.io/tx/${data.txHash}`, "_blank"),
        } : undefined,
      });
      await fetchLedger();
    } catch (e) {
      toast.error("Claim failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setClaiming(false);
    }
  };

  const handleForceCollect = async () => {
    setCollecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("eth-collect-fees", {
        body: { tokenAddress },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Collect failed");
      toast.success("Fees collected from pool", {
        description: `${data.collected} position(s) processed`,
      });
      await fetchLedger();
    } catch (e) {
      toast.error("Collect failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setCollecting(false);
    }
  };

  // No ledger row = token was launched before the V3 vault upgrade and the
  // creator was never registered on-chain → fees CAN'T be claimed for this token.
  // Show an explanatory banner instead of silently hiding the panel.
  if (!loading && !ledger) {
    return (
      <Card className="bg-amber-500/5 border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Creator Fees Unavailable
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            This token was launched on a previous version of the platform launcher that did not
            register creators with the fee vault. The 1% Uniswap V3 trading fees are still being
            collected by the platform but cannot be split to your wallet for this token.
            New tokens launched after the V3 upgrade will accrue claimable fees normally.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!isCreator && !embedded) return null;

  const inner = (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="p-2 rounded-md bg-secondary/40 border border-border/40">
          <div className="text-muted-foreground">Lifetime Pool Fees</div>
          <div className="text-foreground">{lifetimeEth} ETH</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 border border-border/40">
          <div className="text-muted-foreground">Your Share (50%)</div>
          <div className="text-foreground">{totalEarnedEth} ETH</div>
        </div>
        <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30">
          <div className="text-emerald-300/80">Claimable</div>
          <div className="text-emerald-300 font-bold">{claimableEth} ETH</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={handleClaim}
          disabled={!isCreator || claiming || claimableEth === "0.000000"}
          className="h-10"
        >
          {claiming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Coins className="mr-1.5 h-4 w-4" />}
          Claim {claimableEth} ETH
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleForceCollect}
          disabled={collecting}
          className="h-10"
          title="Force-collect accrued fees from the Uniswap V3 position into the platform vault"
        >
          {collecting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Sync Pool Fees
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        The LP NFT is held in the platform vault for security. Every ~6h, accrued 1% Uniswap V3 trading
        fees are collected and your <strong className="text-foreground">50% share</strong> becomes claimable.
        You can also <strong className="text-foreground">Sync Pool Fees</strong> manually to refresh.
      </p>

      {ledger?.last_claim_tx && (
        <a
          href={`https://etherscan.io/tx/${ledger.last_claim_tx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-1"
        >
          Last claim: {ledger.last_claim_tx.slice(0, 10)}…{ledger.last_claim_tx.slice(-6)}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Creator Earnings
        </CardTitle>
        <CardDescription className="text-xs">
          You earn 50% of all 1% trading fees on this token.
        </CardDescription>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
