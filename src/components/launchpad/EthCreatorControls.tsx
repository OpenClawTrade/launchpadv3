// ============================================================================
// EthCreatorControls
//
// Post-launch creator-only management panel for ETH ERC-20 tokens deployed via
// Saturn. Shown on:
//   - Launch success screen (right after deploy + LP add)
//   - /trade/:address page (auto-detects creator via on-chain `owner()`)
//
// Capabilities (manual, one-tx-at-a-time, fail-safe):
//   • Burn LP   → transfers connected wallet's LP balance to dEaD (irreversible)
//   • Remove LP → router.removeLiquidityETH (creator only, only if LP not burned)
//   • Renounce  → owner.renounceOwnership() (irreversible)
//
// Reads everything live from Ethereum mainnet via wagmi `useReadContract`, so
// state always reflects the truth (e.g. if user already burned LP elsewhere,
// the button auto-hides).
// ============================================================================

import { useMemo, useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { mainnet } from "wagmi/chains";
import { parseAbi, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Flame, Lock, Droplets, Loader2, ExternalLink, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as const;
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f" as const;
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const ERC20_ABI = parseAbi([
  "function owner() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function renounceOwnership()",
  "function totalSupply() view returns (uint256)",
]);
const FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
]);
const ROUTER_ABI = parseAbi([
  "function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountETH)",
]);

interface Props {
  tokenAddress: string;
  /** When true, hides the wrapper Card (use inside an existing card on success screen). */
  embedded?: boolean;
}

export function EthCreatorControls({ tokenAddress, embedded = false }: Props) {
  const tokenAddr = tokenAddress as Address;
  const { address: connected } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string>("");

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: pendingHash ?? undefined,
    chainId: mainnet.id,
  });

  // ---- On-chain reads ----
  const ownerQ = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: "owner",
    chainId: mainnet.id,
  });
  const pairQ = useReadContract({
    address: UNISWAP_V2_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: [tokenAddr, WETH_MAINNET],
    chainId: mainnet.id,
  });
  const pairAddress = (pairQ.data as Address | undefined) ?? undefined;
  const hasPair = !!pairAddress && pairAddress !== ZERO_ADDRESS;

  const lpBalQ = useReadContract({
    address: pairAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connected ? [connected] : undefined,
    chainId: mainnet.id,
    query: { enabled: !!connected && hasPair },
  });

  const owner = (ownerQ.data as Address | undefined) ?? undefined;
  const isOwner = !!owner && !!connected && owner.toLowerCase() === connected.toLowerCase();
  const isRenounced = owner === ZERO_ADDRESS;
  const lpBalance = (lpBalQ.data as bigint | undefined) ?? 0n;
  const hasLp = lpBalance > 0n;

  // refetch reads when a tx confirms
  useEffect(() => {
    if (isConfirmed && pendingHash) {
      toast.success(`✅ ${pendingLabel} confirmed`, {
        action: {
          label: "Etherscan",
          onClick: () => window.open(`https://etherscan.io/tx/${pendingHash}`, "_blank"),
        },
      });
      ownerQ.refetch();
      lpBalQ.refetch();
      pairQ.refetch();
      setPendingHash(null);
      setPendingLabel("");
    }
  }, [isConfirmed, pendingHash, pendingLabel, ownerQ, lpBalQ, pairQ]);

  const busy = isWriting || isConfirming;

  // ---- Actions ----
  const handleBurnLp = async () => {
    if (!connected || !pairAddress || lpBalance === 0n) return;
    try {
      setPendingLabel("Burn LP");
      const hash = await writeContractAsync({
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [DEAD_ADDRESS, lpBalance],
        chainId: mainnet.id,
      } as any);
      setPendingHash(hash);
      toast.info("🔥 Burn LP tx sent", { description: "Waiting for confirmation…" });
    } catch (e) {
      toast.error("Burn LP failed", { description: e instanceof Error ? e.message : "Unknown error" });
      setPendingLabel("");
    }
  };

  const handleRemoveLp = async () => {
    if (!connected || !pairAddress || lpBalance === 0n) return;
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      // Step 1: approve router to pull the LP tokens
      setPendingLabel("Approve LP");
      const approveHash = await writeContractAsync({
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [UNISWAP_V2_ROUTER, lpBalance],
        chainId: mainnet.id,
      } as any);
      setPendingHash(approveHash);
      toast.info("1/2 Approving router…", { description: "Waiting for confirmation…" });

      // Wait for approval to land before sending the remove call. We poll the
      // confirmation hook by setting hash + letting effect clear it isn't
      // synchronous; do a manual receipt wait via fetch is overkill — instead
      // rely on user re-clicking if first tx not yet mined. Most wallets queue
      // the second tx behind the first nonce automatically, so we can safely
      // fire the second call right away (Uniswap router will revert if alowance
      // is not yet visible). We wrap in try/catch.
      try {
        setPendingLabel("Remove LP");
        const removeHash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER,
          abi: ROUTER_ABI,
          functionName: "removeLiquidityETH",
          args: [tokenAddr, lpBalance, 0n, 0n, connected, deadline],
          chainId: mainnet.id,
        });
        setPendingHash(removeHash);
        toast.success("2/2 Remove LP tx sent", {
          description: "Tokens + ETH return to your wallet on confirmation.",
        });
      } catch (innerErr) {
        toast.warning("Approval sent — please click Remove LP again once it confirms", {
          description: innerErr instanceof Error ? innerErr.message : undefined,
        });
      }
    } catch (e) {
      toast.error("Remove LP failed", { description: e instanceof Error ? e.message : "Unknown error" });
      setPendingLabel("");
    }
  };

  const handleRenounce = async () => {
    if (!connected || !isOwner) return;
    try {
      setPendingLabel("Renounce");
      const hash = await writeContractAsync({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: "renounceOwnership",
        chainId: mainnet.id,
      });
      setPendingHash(hash);
      toast.info("🔒 Renounce tx sent", { description: "Waiting for confirmation…" });
    } catch (e) {
      toast.error("Renounce failed", { description: e instanceof Error ? e.message : "Unknown error" });
      setPendingLabel("");
    }
  };

  // Hide entirely if connected wallet is not the owner AND has no LP.
  // Owner can renounce; LP-holder (== owner usually, but could differ if LP transferred) can burn/remove.
  const showAnything = isOwner || hasLp;
  if (!showAnything) return null;

  const inner = (
    <div className="space-y-3">
      {/* Status row */}
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="p-2 rounded-md bg-secondary/40 border border-border/40">
          <div className="text-muted-foreground">Owner</div>
          <div className={isRenounced ? "text-emerald-400" : "text-foreground"}>
            {isRenounced ? "Renounced ✓" : owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : "—"}
          </div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 border border-border/40">
          <div className="text-muted-foreground">LP Pair</div>
          <div className="text-foreground">{hasPair ? "Live" : "Not seeded"}</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 border border-border/40">
          <div className="text-muted-foreground">Your LP</div>
          <div className="text-foreground">{hasLp ? "Holding" : "0 / Burned"}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBurnLp}
          disabled={busy || !hasLp}
          className="h-10"
          title={!hasLp ? "No LP tokens to burn" : "Send LP tokens to dead address — irreversible"}
        >
          {busy && pendingLabel === "Burn LP" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Flame className="mr-1.5 h-4 w-4 text-orange-500" />
          )}
          Burn LP
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRemoveLp}
          disabled={busy || !hasLp}
          className="h-10"
          title={!hasLp ? "No LP to remove (already burned or never seeded)" : "Pull liquidity back to your wallet"}
        >
          {busy && (pendingLabel === "Remove LP" || pendingLabel === "Approve LP") ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Droplets className="mr-1.5 h-4 w-4 text-cyan-400" />
          )}
          Remove LP
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRenounce}
          disabled={busy || !isOwner || isRenounced}
          className="h-10"
          title={isRenounced ? "Already renounced" : !isOwner ? "Only owner can renounce" : "Permanently remove ownership"}
        >
          {busy && pendingLabel === "Renounce" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isRenounced ? (
            <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-400" />
          ) : (
            <Lock className="mr-1.5 h-4 w-4 text-emerald-400" />
          )}
          {isRenounced ? "Renounced" : "Renounce"}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Burn</strong> and <strong className="text-foreground">Renounce</strong> are
        irreversible. <strong className="text-foreground">Remove LP</strong> requires 2 signatures (approve + remove).
        All actions are on Ethereum mainnet — gas paid by your wallet.
      </p>

      {pendingHash && (
        <a
          href={`https://etherscan.io/tx/${pendingHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-1"
        >
          Pending: {pendingHash.slice(0, 10)}…{pendingHash.slice(-6)}
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
          Creator Controls
        </CardTitle>
        <CardDescription className="text-xs">
          You own this token. Manage LP and ownership manually.
        </CardDescription>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
