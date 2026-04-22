import { useEffect, useMemo, useState } from "react";
import { isAddress, parseEther, parseUnits, type Address } from "viem";
import { mainnet } from "viem/chains";
import { useWalletClient, useSwitchChain, useChainId } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Flame,
  Lock,
  Droplets,
  Power,
  ShieldCheck,
  Loader2,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { useTokenInspector } from "@/hooks/useTokenInspector";
import {
  ERC20_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_ROUTER,
  UNISWAP_V2_ROUTER_ABI,
  DEAD_ADDRESS,
  ETHERSCAN_TX,
  ETHERSCAN_ADDR,
  ETHERSCAN_TOKEN,
  ETHERSCAN_VERIFY,
  DEXSCREENER_URL,
  UNISWAP_ADD_URL,
} from "@/lib/ethereum/launchControl";

/* -------------------------------------------------------------------------- */
/*                                Tiny helpers                                */
/* -------------------------------------------------------------------------- */

function shortAddr(a?: string | null) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

/** Status pill: ✓ done, ✗ pending, ⚠ unknown */
function StatusPill({
  state,
  label,
}: {
  state: "ok" | "pending" | "warn" | "unknown";
  label: string;
}) {
  const map = {
    ok: { Icon: CheckCircle2, cls: "bg-primary/10 text-primary border-primary/30" },
    pending: { Icon: XCircle, cls: "bg-muted text-muted-foreground border-border" },
    warn: { Icon: AlertTriangle, cls: "bg-destructive/10 text-destructive border-destructive/30" },
    unknown: { Icon: AlertTriangle, cls: "bg-muted text-muted-foreground border-border" },
  } as const;
  const { Icon, cls } = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Action Card wrapper                            */
/* -------------------------------------------------------------------------- */

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  status: "ok" | "pending" | "warn" | "unknown";
  statusLabel: string;
  children: React.ReactNode;
}

function ActionCard({ title, description, icon: Icon, status, statusLabel, children }: ActionCardProps) {
  return (
    <Card className="bg-card/40 border-border/40 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <StatusPill state={status} label={statusLabel} />
      </div>
      {children}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function LaunchNowPage() {
  const [caInput, setCaInput] = useState("");
  const [activeCA, setActiveCA] = useState<string | null>(null);

  const { address, isConnected, connect } = useEvmWallet();
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();

  const { data: token, isLoading, refetch, isFetching } = useTokenInspector(activeCA, address);

  // SEO
  useEffect(() => {
    const prev = document.title;
    document.title = "Launch Control — Manage your ETH token | Popshiba";
    return () => { document.title = prev; };
  }, []);

  const handleInspect = () => {
    const trimmed = caInput.trim();
    if (!isAddress(trimmed)) {
      toast.error("Enter a valid contract address (0x...)");
      return;
    }
    setActiveCA(trimmed);
  };

  const isOwner = useMemo(() => {
    if (!token?.owner || !address) return false;
    return token.owner.toLowerCase() === address.toLowerCase();
  }, [token?.owner, address]);

  /* -------------------------- Action: Verify (link out) ------------------ */
  const verifyState: "ok" | "pending" | "unknown" =
    token?.isVerified === true ? "ok" : token?.isVerified === false ? "pending" : "unknown";

  /* -------------------------- Action: Add LP ----------------------------- */
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [lpEthAmount, setLpEthAmount] = useState("");
  const [addingLp, setAddingLp] = useState(false);

  const ensureChain = async (): Promise<boolean> => {
    if (currentChainId !== mainnet.id) {
      try {
        await switchChainAsync?.({ chainId: mainnet.id });
      } catch {
        toast.error("Switch to Ethereum Mainnet to continue");
        return false;
      }
    }
    return true;
  };

  const handleAddLp = async () => {
    if (!walletClient || !address || !token) return;
    const tokenAmt = Number(lpTokenAmount);
    const ethAmt = Number(lpEthAmount);
    if (!(tokenAmt > 0) || !(ethAmt > 0)) {
      toast.error("Enter both token and ETH amounts");
      return;
    }
    if (!(await ensureChain())) return;

    setAddingLp(true);
    try {
      const tokensWei = parseUnits(String(tokenAmt), token.decimals);
      const ethWei = parseEther(String(ethAmt));
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      // 1. Approve router
      toast.info("Step 1/2: Approve router to spend your tokens…");
      const approveHash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [UNISWAP_V2_ROUTER, tokensWei],
      });
      toast.success(
        <a href={ETHERSCAN_TX(approveHash)} target="_blank" rel="noopener noreferrer" className="underline">
          Approve sent — view tx
        </a>
      );

      // Wait for approval to land before sending addLiquidity (so user doesn't get a revert)
      await new Promise((r) => setTimeout(r, 4000));

      // 2. addLiquidityETH
      toast.info("Step 2/2: Adding liquidity…");
      const lpHash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: UNISWAP_V2_ROUTER,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: "addLiquidityETH",
        args: [
          token.address,
          tokensWei,
          (tokensWei * 95n) / 100n, // 5% slippage
          (ethWei * 95n) / 100n,
          address as Address,
          deadline,
        ],
        value: ethWei,
      });
      toast.success(
        <a href={ETHERSCAN_TX(lpHash)} target="_blank" rel="noopener noreferrer" className="underline">
          Liquidity added — view tx
        </a>
      );
      setLpTokenAmount("");
      setLpEthAmount("");
      setTimeout(() => refetch(), 8000);
    } catch (e: any) {
      console.error("[add-lp]", e);
      toast.error(e?.shortMessage || e?.message || "Add liquidity failed");
    } finally {
      setAddingLp(false);
    }
  };

  /* -------------------------- Action: setRule ---------------------------- */
  const [openingTrading, setOpeningTrading] = useState(false);
  const handleOpenTrading = async (limited: boolean) => {
    if (!walletClient || !address || !token || !token.pairAddress) return;
    if (!(await ensureChain())) return;
    setOpeningTrading(true);
    try {
      // Default: 2% max wallet when limited; unlimited when not.
      const maxHolding = limited
        ? (token.totalSupply * 2n) / 100n // 2%
        : token.totalSupply; // effectively unlimited

      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.address,
        abi: ERC20_ABI,
        functionName: "setRule",
        args: [limited, token.pairAddress, maxHolding, 0n],
      });
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          {limited ? "Trading opened (with 2% max wallet)" : "Limits removed"} — view tx
        </a>
      );
    } catch (e: any) {
      console.error("[setRule]", e);
      toast.error(e?.shortMessage || e?.message || "setRule failed");
    } finally {
      setOpeningTrading(false);
    }
  };

  /* -------------------------- Action: Renounce --------------------------- */
  const [renouncing, setRenouncing] = useState(false);
  const handleRenounce = async () => {
    if (!walletClient || !address || !token) return;
    if (!confirm("Renounce ownership permanently? This cannot be undone.")) return;
    if (!(await ensureChain())) return;
    setRenouncing(true);
    try {
      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.address,
        abi: ERC20_ABI,
        functionName: "renounceOwnership",
        args: [],
      });
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          Ownership renounced — view tx
        </a>
      );
      setTimeout(() => refetch(), 6000);
    } catch (e: any) {
      console.error("[renounce]", e);
      toast.error(e?.shortMessage || e?.message || "Renounce failed");
    } finally {
      setRenouncing(false);
    }
  };

  /* -------------------------- Action: Burn LP ---------------------------- */
  const [burningLp, setBurningLp] = useState(false);
  const handleBurnLp = async () => {
    if (!walletClient || !address || !token?.pairAddress || !token.userLpBalance) return;
    if (token.userLpBalance === 0n) {
      toast.error("You don't hold any LP tokens for this pair");
      return;
    }
    if (!confirm("Burn ALL your LP tokens to the dead address? This is permanent.")) return;
    if (!(await ensureChain())) return;
    setBurningLp(true);
    try {
      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "transfer",
        args: [DEAD_ADDRESS, token.userLpBalance],
      } as any);
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          LP burned — view tx
        </a>
      );
      setTimeout(() => refetch(), 6000);
    } catch (e: any) {
      console.error("[burn-lp]", e);
      toast.error(e?.shortMessage || e?.message || "Burn LP failed");
    } finally {
      setBurningLp(false);
    }
  };

  /* -------------------------- Action: Remove LP -------------------------- */
  const [removingLp, setRemovingLp] = useState(false);
  const handleRemoveLp = async () => {
    if (!walletClient || !address || !token?.pairAddress || !token.userLpBalance) return;
    if (token.userLpBalance === 0n) {
      toast.error("You don't hold any LP tokens");
      return;
    }
    if (!confirm("Remove ALL your liquidity? This withdraws your share of tokens + ETH from the pool.")) return;
    if (!(await ensureChain())) return;
    setRemovingLp(true);
    try {
      const liquidity = token.userLpBalance;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      // 1. Approve router to spend LP tokens
      toast.info("Step 1/2: Approve router to spend your LP tokens…");
      await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "approve",
        args: [UNISWAP_V2_ROUTER, liquidity],
      } as any);

      await new Promise((r) => setTimeout(r, 4000));

      // 2. Remove
      toast.info("Step 2/2: Removing liquidity…");
      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: UNISWAP_V2_ROUTER,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: "removeLiquidityETHSupportingFeeOnTransferTokens",
        args: [token.address, liquidity, 0n, 0n, address as Address, deadline],
      });
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          Liquidity removed — view tx
        </a>
      );
      setTimeout(() => refetch(), 8000);
    } catch (e: any) {
      console.error("[remove-lp]", e);
      toast.error(e?.shortMessage || e?.message || "Remove LP failed");
    } finally {
      setRemovingLp(false);
    }
  };

  /* -------------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        {/* Hero */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Token Finalizer · Helper
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Finalize your already-deployed ETH token
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            This is a <strong>helper page</strong> for tokens you've <strong>already deployed</strong> (e.g. via Remix). Paste the contract address and we'll detect what's still needed — verify, add liquidity, open trading, renounce, burn or remove LP — and walk you through each step with MetaMask. <em>This page does not deploy new tokens.</em>
          </p>
        </header>

        {/* Inspect Bar */}
        <Card className="bg-card/40 border-border/40 p-5 mb-6">
          <Label htmlFor="ca-input" className="text-xs uppercase tracking-wider text-muted-foreground">
            Contract address
          </Label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <Input
              id="ca-input"
              placeholder="0x…"
              value={caInput}
              onChange={(e) => setCaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInspect()}
              className="font-mono bg-background/50"
            />
            <Button onClick={handleInspect} disabled={!caInput.trim()}>
              <Search className="h-4 w-4" />
              Inspect
            </Button>
          </div>
          {!isConnected && (
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: <button onClick={connect} className="text-primary underline">connect your wallet</button> first
              so we can show your LP holdings and enable owner-only actions.
            </p>
          )}
        </Card>

        {/* Loading */}
        {activeCA && isLoading && (
          <Card className="bg-card/40 border-border/40 p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Reading contract on Ethereum Mainnet…
          </Card>
        )}

        {/* Inspector Result */}
        {token && (
          <>
            {/* Token header */}
            <Card className="bg-card/40 border-border/40 p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold">{token.name}</h2>
                    <Badge variant="outline">{token.symbol}</Badge>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>{shortAddr(token.address)}</span>
                    <CopyBtn text={token.address} />
                    <a
                      href={ETHERSCAN_TOKEN(token.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Total supply: <span className="text-foreground font-mono">{token.totalSupplyFormatted}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Owner banner */}
              {token.hasOwnerFn && (
                <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="text-muted-foreground uppercase tracking-wider mb-1">Owner</div>
                    <div className="font-mono">{token.isRenounced ? "Renounced ✓" : shortAddr(token.owner!)}</div>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="text-muted-foreground uppercase tracking-wider mb-1">You are owner</div>
                    <div>{isOwner ? "Yes ✓" : token.isRenounced ? "Renounced" : "No"}</div>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                    <div className="text-muted-foreground uppercase tracking-wider mb-1">Pool</div>
                    <div>
                      {token.primaryPool
                        ? `${token.primaryPool.dex === "uniswap-v2" ? "V2" : `V3 ${(token.primaryPool.feeTier ?? 0) / 10000}%`} · ${token.primaryPool.pairedWith}`
                        : "None found"}
                    </div>
                  </div>
                </div>
              )}

              {/* Detected pools list (transparent diagnostics) */}
              <div className="mt-4 rounded-lg bg-background/40 border border-border/40 p-3 text-xs">
                <div className="text-muted-foreground uppercase tracking-wider mb-2">
                  Liquidity scan ({token.allPools.length} pool{token.allPools.length === 1 ? "" : "s"} found)
                </div>
                {token.allPools.length === 0 ? (
                  <p className="text-muted-foreground">
                    Checked Uniswap V2 + V3 (0.01%, 0.05%, 0.3%, 1%) against WETH, USDC and USDT — no pool exists yet for this token.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {token.allPools.map((p) => (
                      <li key={p.pairAddress} className="flex items-center gap-2 font-mono">
                        <Badge variant="outline" className="text-[10px]">
                          {p.dex === "uniswap-v2" ? "V2" : `V3 ${(p.feeTier ?? 0) / 10000}%`}
                        </Badge>
                        <span>{p.pairedWith}</span>
                        <a
                          href={ETHERSCAN_ADDR(p.pairAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {shortAddr(p.pairAddress)} <ExternalLink className="h-3 w-3 inline" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </Card>

            {/* Action grid */}
            <div className="grid gap-4">
              {/* 1. Verify */}
              <ActionCard
                title="1. Verify on Etherscan"
                description="Makes your source code public so buyers trust the contract."
                icon={ShieldCheck}
                status={verifyState}
                statusLabel={
                  verifyState === "ok" ? "Verified" : verifyState === "pending" ? "Not verified" : "Unknown"
                }
              >
                {verifyState === "ok" ? (
                  <p className="text-sm text-muted-foreground">
                    Source code is published.{" "}
                    <a
                      href={`${ETHERSCAN_ADDR(token.address)}#code`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      View on Etherscan
                    </a>
                  </p>
                ) : (
                  <Button asChild variant="outline">
                    <a href={ETHERSCAN_VERIFY(token.address)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open Etherscan verifier
                    </a>
                  </Button>
                )}
              </ActionCard>

              {/* 2. Add LP */}
              <ActionCard
                title="2. Add liquidity (Uniswap V2)"
                description="Pair your tokens with ETH. Auto-runs Approve → Add."
                icon={Droplets}
                status={
                  token.primaryPool?.dex === "uniswap-v2" && (token.reserveEth ?? 0n) > 0n
                    ? "ok"
                    : token.primaryPool
                    ? "warn"
                    : "pending"
                }
                statusLabel={
                  token.primaryPool?.dex === "uniswap-v2"
                    ? `V2 pool live · ${token.reserveEthFormatted} ETH`
                    : token.primaryPool?.dex === "uniswap-v3"
                    ? `V3 pool exists (${token.primaryPool.pairedWith})`
                    : "No pool yet"
                }
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Token amount ({token.symbol})</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 1000000000"
                      value={lpTokenAmount}
                      onChange={(e) => setLpTokenAmount(e.target.value)}
                      className="bg-background/50 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ETH amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.5"
                      value={lpEthAmount}
                      onChange={(e) => setLpEthAmount(e.target.value)}
                      className="bg-background/50 mt-1"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={handleAddLp}
                    disabled={!isConnected || addingLp || !lpTokenAmount || !lpEthAmount}
                  >
                    {addingLp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
                    Add liquidity
                  </Button>
                  <Button asChild variant="outline">
                    <a href={UNISWAP_ADD_URL(token.address)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open Uniswap UI instead
                    </a>
                  </Button>
                </div>
              </ActionCard>

              {/* 3. setRule */}
              {token.hasSetRule && (
                <ActionCard
                  title="3. Open trading (setRule)"
                  description="Lifts the deploy-time anti-bot lock so people can buy."
                  icon={Power}
                  status="warn"
                  statusLabel="Owner action"
                >
                  <p className="text-sm text-muted-foreground mb-3">
                    Most anti-bot tokens use <code className="text-foreground">setRule(_limited, pair, maxHolding, 0)</code>.
                    Choose:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleOpenTrading(true)}
                      disabled={!isConnected || openingTrading || !token.pairAddress || !isOwner}
                    >
                      {openingTrading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Open with 2% max wallet
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenTrading(false)}
                      disabled={!isConnected || openingTrading || !token.pairAddress || !isOwner}
                    >
                      Remove all limits
                    </Button>
                  </div>
                  {!token.pairAddress && (
                    <p className="text-xs text-destructive mt-2">Add liquidity first — setRule needs the pair address.</p>
                  )}
                  {!isOwner && token.hasOwnerFn && !token.isRenounced && (
                    <p className="text-xs text-muted-foreground mt-2">Only the contract owner can call this.</p>
                  )}
                </ActionCard>
              )}

              {/* 4. Renounce */}
              {token.hasOwnerFn && (
                <ActionCard
                  title="4. Renounce ownership"
                  description="Permanently transfers ownership to 0x000…000. Builds buyer trust."
                  icon={Lock}
                  status={token.isRenounced ? "ok" : "pending"}
                  statusLabel={token.isRenounced ? "Renounced" : "Not renounced"}
                >
                  {token.isRenounced ? (
                    <p className="text-sm text-muted-foreground">Ownership already renounced.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">
                        ⚠️ Irreversible. Make sure trading is open and you'll never need to call any owner-only function again.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleRenounce}
                        disabled={!isConnected || renouncing || !isOwner}
                      >
                        {renouncing && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Lock className="h-4 w-4" />
                        Renounce ownership
                      </Button>
                    </>
                  )}
                </ActionCard>
              )}

              {/* 5. Burn LP */}
              <ActionCard
                title="5. Burn LP tokens"
                description="Sends your LP tokens to dead address. Buyers see ✅ LP Burned forever."
                icon={Flame}
                status={
                  token.lpBurnedPercent != null && token.lpBurnedPercent > 90
                    ? "ok"
                    : "pending"
                }
                statusLabel={
                  token.lpBurnedPercent != null
                    ? `${token.lpBurnedPercent.toFixed(1)}% burned`
                    : "Unknown"
                }
              >
                {!token.hasPair ? (
                  <p className="text-sm text-muted-foreground">No pool yet — add liquidity first.</p>
                ) : !isConnected ? (
                  <Button onClick={connect} variant="outline">Connect wallet to see your LP</Button>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your LP balance: <span className="text-foreground font-mono">
                        {token.userLpBalance != null
                          ? (Number(token.userLpBalance) / 1e18).toFixed(6)
                          : "—"}
                      </span> LP
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleBurnLp}
                      disabled={burningLp || !token.userLpBalance || token.userLpBalance === 0n}
                    >
                      {burningLp && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Flame className="h-4 w-4" />
                      Burn all my LP tokens
                    </Button>
                  </>
                )}
              </ActionCard>

              {/* 6. Remove LP */}
              <ActionCard
                title="6. Remove liquidity"
                description="Withdraw your share of tokens + ETH from the pool."
                icon={Droplets}
                status="warn"
                statusLabel="Caution"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  ⚠️ Removing LP tanks the price for holders. Only do this if you're winding down the project.
                </p>
                {!token.hasPair ? (
                  <p className="text-sm text-muted-foreground">No pool to remove from.</p>
                ) : !isConnected ? (
                  <Button onClick={connect} variant="outline">Connect wallet</Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={handleRemoveLp}
                    disabled={removingLp || !token.userLpBalance || token.userLpBalance === 0n}
                  >
                    {removingLp && <Loader2 className="h-4 w-4 animate-spin" />}
                    Remove all my liquidity
                  </Button>
                )}
              </ActionCard>

              {/* 7. DexScreener */}
              <ActionCard
                title="7. Submit token info to DexScreener"
                description="Add logo, socials, and description so your token looks pro on charts."
                icon={ExternalLink}
                status="unknown"
                statusLabel="Optional"
              >
                <Button asChild variant="outline">
                  <a href={DEXSCREENER_URL(token.address)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open DexScreener page
                  </a>
                </Button>
              </ActionCard>
            </div>

            <Separator className="my-8" />
            <p className="text-center text-xs text-muted-foreground">
              All actions sign through MetaMask · Ethereum Mainnet only · Your private key never leaves your wallet
            </p>
          </>
        )}
      </div>
    </main>
  );
}
