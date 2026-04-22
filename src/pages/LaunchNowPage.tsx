import { useEffect, useMemo, useState } from "react";
import "./launchnow-popshiba.css";
import { isAddress, parseEther, parseUnits, formatUnits, type Address } from "viem";
import { mainnet } from "viem/chains";
import { useWalletClient, useSwitchChain, useChainId } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Rocket,
} from "lucide-react";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { useTokenInspector } from "@/hooks/useTokenInspector";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { PEPE_LIKE_ABI, PEPE_LIKE_BYTECODE } from "@/lib/ethereum/pepeLikeToken";
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
  const [tab, setTab] = useState<"manage" | "launch">("manage");
  const [caInput, setCaInput] = useState("");
  const [activeCA, setActiveCA] = useState<string | null>(null);

  // ---- Launch (deploy new token) state ----
  const [deployName, setDeployName] = useState("");
  const [deploySymbol, setDeploySymbol] = useState("");
  const [deploySupply, setDeploySupply] = useState("420690000000000"); // PEPE-style default (whole tokens, 18d)
  const [deploying, setDeploying] = useState(false);
  const [lastDeployedCA, setLastDeployedCA] = useState<string | null>(null);
  const [lastDeployTx, setLastDeployTx] = useState<string | null>(null);
  const [deployHeader, setDeployHeader] = useState<string>(
    "// Launched with Popshiba — https://popshiba.com\n// Built different. Built on Ethereum.\n// gm."
  );

  const { address, isConnected, connect, disconnect, logout, balance, isOnEthereum, switchToEthereum } = useEvmWallet();
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();

  const { data: token, isLoading, refetch, isFetching } = useTokenInspector(activeCA, address);
  const { data: heldTokens, isLoading: heldLoading, refetch: refetchHeld } = useWalletTokens(address);

  // SEO + load Popshiba fonts (Archivo Black + Space Grotesk + JetBrains Mono)
  useEffect(() => {
    const prev = document.title;
    document.title = "Launch Control — Manage your ETH token | Popshiba";
    const FONT_ID = "popshiba-launchnow-fonts";
    if (!document.getElementById(FONT_ID)) {
      const l = document.createElement("link");
      l.id = FONT_ID;
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
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

  const v2WethPool = useMemo(() => {
    return (token?.allPools ?? []).find(
      (pool) => pool.dex === "uniswap-v2" && pool.pairedWith === "WETH"
    ) ?? null;
  }, [token?.allPools]);

  const setRulePairAddress = v2WethPool?.pairAddress ?? null;
  const selectedV2PoolIsPrimary =
    !!setRulePairAddress &&
    !!token?.primaryPool?.pairAddress &&
    token.primaryPool.pairAddress.toLowerCase() === setRulePairAddress.toLowerCase();
  const knownV2PoolHasNoLiquidity =
    !!setRulePairAddress && selectedV2PoolIsPrimary && (token?.reserveEth ?? 0n) === 0n;

  const setRuleBlockedReason = useMemo(() => {
    if (!token?.hasSetRule) return null;
    if (!setRulePairAddress) {
      return "No Uniswap V2 WETH pair found yet. If you call setRule now it can revert, or appear to succeed without actually opening trading.";
    }
    if (knownV2PoolHasNoLiquidity) {
      return "A Uniswap V2 pair address exists, but its reserves are still zero. Fund the pool first, then open trading.";
    }
    return null;
  }, [token?.hasSetRule, setRulePairAddress, knownV2PoolHasNoLiquidity]);

  /* -------------------------- Action: Verify (link out) ------------------ */
  const verifyState: "ok" | "pending" | "unknown" =
    token?.isVerified === true ? "ok" : token?.isVerified === false ? "pending" : "unknown";

  /* -------------------------- Action: Add LP ----------------------------- */
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [lpEthAmount, setLpEthAmount] = useState("");
  const [lpPctOfSupply, setLpPctOfSupply] = useState<string>("80"); // % of total supply to seed
  const [lpAutoCalc, setLpAutoCalc] = useState<boolean>(true); // auto-derive token amount from % of supply
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

  /* ----------------------- Action: Deploy new token ---------------------- */
  const handleDeploy = async () => {
    if (!walletClient || !address) {
      toast.error("Connect a wallet first");
      return;
    }
    const name = deployName.trim();
    const symbol = deploySymbol.trim();
    const supplyStr = deploySupply.trim();
    if (!name || name.length > 32) { toast.error("Enter a name (1–32 chars)"); return; }
    if (!symbol || symbol.length > 12) { toast.error("Enter a symbol (1–12 chars)"); return; }
    let supplyWhole: bigint;
    try {
      supplyWhole = BigInt(supplyStr.replace(/[, _]/g, ""));
      if (supplyWhole <= 0n) throw new Error("supply must be > 0");
    } catch {
      toast.error("Supply must be a whole number > 0");
      return;
    }
    if (!(await ensureChain())) return;

    setDeploying(true);
    setLastDeployedCA(null);
    setLastDeployTx(null);
    try {
      const totalSupplyWei = supplyWhole * 10n ** 18n;
      toast.info("Confirm the deploy in your wallet…");
      const hash = await walletClient.deployContract({
        account: address as Address,
        chain: mainnet,
        abi: PEPE_LIKE_ABI as any,
        bytecode: PEPE_LIKE_BYTECODE,
        args: [name, symbol, totalSupplyWei],
      } as any);
      setLastDeployTx(hash);
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          Deploy submitted — view tx
        </a>
      );
      // Wait for receipt to grab the contract address.
      const { createPublicClient, http } = await import("viem");
      const pc = createPublicClient({ chain: mainnet, transport: http() });
      const receipt = await pc.waitForTransactionReceipt({ hash });
      const ca = receipt.contractAddress;
      if (ca) {
        setLastDeployedCA(ca);
        toast.success(`Deployed at ${ca.slice(0, 10)}…`);
        // Auto-load it into the Manage tab.
        setCaInput(ca);
        setActiveCA(ca);
        setTab("manage");
        setTimeout(() => refetchHeld(), 4000);
      } else {
        toast.warning("Deploy tx mined but no contract address found in receipt.");
      }
    } catch (e: any) {
      console.error("[deploy]", e);
      toast.error(e?.shortMessage || e?.message || "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  /* ---- Auto-derive token amount from % of total supply (LP helper) ---- */
  useEffect(() => {
    if (!lpAutoCalc || !token) return;
    const pct = Number(lpPctOfSupply);
    if (!(pct > 0) || pct > 100) return;
    // tokens = totalSupply * pct / 100  (in whole tokens, formatted)
    const whole = (token.totalSupply * BigInt(Math.round(pct * 1000))) / 100000n;
    const formatted = formatUnits(whole, token.decimals);
    // Trim trailing .000 if any
    setLpTokenAmount(formatted.replace(/\.0+$/, ""));
  }, [lpAutoCalc, lpPctOfSupply, token]);

  const handleAddLp = async () => {
    if (!walletClient || !address || !token) return;
    const ethAmt = Number(lpEthAmount);
    if (!(ethAmt > 0)) {
      toast.error("Enter ETH amount");
      return;
    }
    if (!lpTokenAmount || Number(lpTokenAmount) <= 0) {
      toast.error("Enter token amount (or set % of supply)");
      return;
    }
    if (!(await ensureChain())) return;

    setAddingLp(true);
    try {
      // Use string parsing to preserve precision for large token amounts
      const tokensWei = parseUnits(lpTokenAmount.replace(/,/g, ""), token.decimals);
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
          (tokensWei * 95n) / 100n,
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
    if (!walletClient || !address || !token || !setRulePairAddress) {
      if (setRuleBlockedReason) toast.error(setRuleBlockedReason);
      return;
    }
    if (setRuleBlockedReason) {
      toast.error(setRuleBlockedReason);
      return;
    }
    if (!(await ensureChain())) return;
    setOpeningTrading(true);
    try {
      const maxHolding = limited ? (token.totalSupply * 2n) / 100n : 0n;

      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: token.address,
        abi: ERC20_ABI,
        functionName: "setRule",
        args: [limited, setRulePairAddress, maxHolding, 0n],
      });
      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          {limited ? "Trading opened (with 2% max wallet)" : "Limits removed"} — view tx
        </a>
      );
      // Re-read on-chain state so the page reflects the new limited / max-wallet values.
      setTimeout(() => refetch(), 6000);
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
    <main className="popshiba-launchnow min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        {/* Hero — Popshiba brutalist style */}
        <header className="pop-hero mb-7">
          <div className="pop-tag">
            <span className="d" />
            <ShieldCheck className="h-3.5 w-3.5" />
            Launch Control · Ethereum Mainnet
          </div>
          <h1>
            Launch &amp; manage <em>your ETH token</em>
          </h1>
          <p className="lede mt-3">
            One control center for ERC-20s on Ethereum. <strong>Launch new token</strong> deploys a PEPE-style contract (Ownable + setRule + blacklist + burn) straight from your wallet. <strong>Manage existing</strong> detects what's still needed for any token you own — verify, add liquidity, open trading, renounce, burn or remove LP — and walks you through each step with MetaMask.
          </p>
        </header>

        {/* Wallet Panel */}
        <Card className="bg-card/40 border-border/40 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {isConnected ? "Connected wallet" : "No wallet connected"}
                </div>
                {isConnected && address ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="font-mono text-sm truncate">{shortAddr(address)}</code>
                    <CopyBtn text={address} />
                    <a
                      href={ETHERSCAN_ADDR(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="View on Etherscan"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {balance} ETH
                    </Badge>
                    {!isOnEthereum && (
                      <Badge variant="destructive" className="text-[10px]">Wrong network</Badge>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-0.5">
                    Connect to manage tokens you own.
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isConnected && !isOnEthereum && (
                <Button size="sm" variant="outline" onClick={() => switchToEthereum()}>
                  Switch to Ethereum
                </Button>
              )}
              {isConnected ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => connect()}>
                    Switch wallet
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      disconnect();
                      setActiveCA(null);
                      setCaInput("");
                      logout?.();
                    }}
                  >
                    <Power className="h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => connect()}>
                  Connect wallet
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tabs: Manage existing | Launch new */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "manage" | "launch")} className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Manage existing
            </TabsTrigger>
            <TabsTrigger value="launch" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Launch new token
            </TabsTrigger>
          </TabsList>

          <TabsContent value="launch" className="mt-4">
            <Card className="bg-card/40 border-border/40 p-5">
              <div className="mb-4">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Deploy a new ERC-20 (PepeToken-style)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Same contract pattern as the popular PEPE launches: <strong>Ownable</strong> + <strong>setRule</strong> (anti-bot max wallet) + <strong>blacklist</strong> + <strong>burn</strong>. After deploy, the token lands directly into the Manage tab so you can add LP, open trading, renounce, and burn LP from the same page.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="d-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Token name
                  </Label>
                  <Input
                    id="d-name"
                    placeholder="e.g. Popshiba"
                    value={deployName}
                    onChange={(e) => setDeployName(e.target.value)}
                    className="mt-1 bg-background/50"
                    maxLength={32}
                  />
                </div>
                <div>
                  <Label htmlFor="d-symbol" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Ticker / symbol
                  </Label>
                  <Input
                    id="d-symbol"
                    placeholder="e.g. POPSHIBA"
                    value={deploySymbol}
                    onChange={(e) => setDeploySymbol(e.target.value.toUpperCase())}
                    className="mt-1 bg-background/50 font-mono"
                    maxLength={12}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="d-supply" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total supply (whole tokens — 18 decimals applied automatically)
                  </Label>
                  <Input
                    id="d-supply"
                    placeholder="420690000000000"
                    value={deploySupply}
                    onChange={(e) => setDeploySupply(e.target.value.replace(/[^\d]/g, ""))}
                    className="mt-1 bg-background/50 font-mono"
                    inputMode="numeric"
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {[
                      { label: "1B", v: "1000000000" },
                      { label: "1T", v: "1000000000000" },
                      { label: "PEPE-style 420.69T", v: "420690000000000" },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setDeploySupply(p.v)}
                        className="px-2 py-1 rounded border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-background/40 border border-border/40 p-3 text-xs text-muted-foreground space-y-1">
                <div>• Contract owner = your connected wallet.</div>
                <div>• Trading is locked until you set a Uniswap V2 pair via <code>setRule</code> (built into Manage tab).</div>
                <div>• Solidity 0.8.20, optimizer on (200 runs). Verify from the Manage tab after deploy.</div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleDeploy}
                  disabled={deploying || !isConnected || !deployName.trim() || !deploySymbol.trim() || !deploySupply.trim()}
                  size="lg"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deploying…
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Deploy token
                    </>
                  )}
                </Button>
                {!isConnected && (
                  <span className="text-xs text-muted-foreground">Connect a wallet first.</span>
                )}
                {lastDeployTx && (
                  <a
                    href={ETHERSCAN_TX(lastDeployTx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    Last deploy tx <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {lastDeployedCA && (
                  <a
                    href={ETHERSCAN_TOKEN(lastDeployedCA)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    Contract: {shortAddr(lastDeployedCA)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="mt-4 space-y-4">
        {/* Your tokens (auto-detected) */}
        {isConnected && (
          <Card className="bg-card/40 border-border/40 p-5 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Your tokens
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Auto-detected ERC-20s in this wallet. Click one to inspect.
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => refetchHeld()} disabled={heldLoading}>
                <RefreshCw className={`h-4 w-4 ${heldLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {heldLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning wallet…
              </div>
            ) : !heldTokens || heldTokens.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                No ERC-20 tokens with a non-zero balance found in this wallet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {heldTokens.filter((t) => !!t?.address).map((t) => {
                  const selected = activeCA?.toLowerCase() === t.address.toLowerCase();
                  return (
                    <button
                      key={t.address}
                      type="button"
                      onClick={() => {
                        setCaInput(t.address);
                        setActiveCA(t.address);
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/40 hover:border-border bg-background/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate">{t.symbol}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{t.balance}</div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{t.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                        {shortAddr(t.address)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Inspect Bar */}
        <Card className="bg-card/40 border-border/40 p-5 mb-6">
          <Label htmlFor="ca-input" className="text-xs uppercase tracking-wider text-muted-foreground">
            Or paste a contract address
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
              {(() => {
                const pools = token.allPools ?? [];
                return (
                  <div className="mt-4 rounded-lg bg-background/40 border border-border/40 p-3 text-xs">
                    <div className="text-muted-foreground uppercase tracking-wider mb-2">
                      Liquidity scan ({pools.length} pool{pools.length === 1 ? "" : "s"} found)
                    </div>
                    {pools.length === 0 ? (
                      <p className="text-muted-foreground">
                        Checked Uniswap V2 + V3 (0.01%, 0.05%, 0.3%, 1%) against WETH, USDC and USDT — no pool exists yet for this token.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {pools.map((p) => (
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
                );
              })()}

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
                  token.primaryPool?.dex === "uniswap-v2" && (token.reserveEth ?? 0n) > 0n
                    ? `V2 pool live · ${token.reserveEthFormatted} ETH`
                    : token.primaryPool?.dex === "uniswap-v2"
                    ? "V2 pair found, fund reserves"
                    : token.primaryPool?.dex === "uniswap-v3"
                    ? `V3 pool exists (${token.primaryPool.pairedWith})`
                    : "No pool yet"
                }
              >
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">ETH amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.5"
                      value={lpEthAmount}
                      onChange={(e) => setLpEthAmount(e.target.value)}
                      className="bg-background/50 mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center justify-between">
                      <span>% of supply to seed</span>
                      <button
                        type="button"
                        onClick={() => setLpAutoCalc((v) => !v)}
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${lpAutoCalc ? "border-primary/40 text-primary" : "border-border/40 text-muted-foreground"}`}
                        title="Toggle auto-calculation of token amount"
                      >
                        {lpAutoCalc ? "Auto" : "Manual"}
                      </button>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      min="0.01"
                      max="100"
                      placeholder="80"
                      value={lpPctOfSupply}
                      onChange={(e) => {
                        setLpPctOfSupply(e.target.value);
                        setLpAutoCalc(true);
                      }}
                      className="bg-background/50 mt-1 font-mono"
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["50", "80", "90", "100"].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setLpPctOfSupply(p); setLpAutoCalc(true); }}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${lpPctOfSupply === p ? "border-primary/60 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Token amount ({token.symbol})</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="auto"
                      value={lpTokenAmount}
                      onChange={(e) => { setLpTokenAmount(e.target.value); setLpAutoCalc(false); }}
                      className="bg-background/50 mt-1 font-mono"
                    />
                  </div>
                </div>
                {(() => {
                  const ethN = Number(lpEthAmount);
                  const tokN = Number(lpTokenAmount);
                  const totalN = Number(formatUnits(token.totalSupply, token.decimals));
                  if (!(ethN > 0) || !(tokN > 0) || !(totalN > 0)) return null;
                  const pricePerToken = ethN / tokN; // ETH per token
                  const initialFdvEth = pricePerToken * totalN;
                  return (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs rounded-md border border-border/40 bg-background/40 p-2.5">
                      <div>
                        <div className="text-muted-foreground">Implied price</div>
                        <div className="font-mono">{pricePerToken.toExponential(3)} ETH</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Initial FDV</div>
                        <div className="font-mono">{initialFdvEth.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">% supply seeded</div>
                        <div className="font-mono">{((tokN / totalN) * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  );
                })()}
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
                {token.primaryPool?.dex === "uniswap-v2" && (token.reserveEth ?? 0n) === 0n && (
                  <p className="mt-3 text-xs text-destructive">
                    A pair address exists, but reserves are still zero. Trading apps will still fail until you actually fund the pool with token + ETH.
                  </p>
                )}
              </ActionCard>

              {/* 3. setRule */}
              {token.hasSetRule && (() => {
                const limitedKnown = token.ruleLimited !== null;
                const tradingOpen = limitedKnown && token.ruleLimited === false;
                const tradingLimited = limitedKnown && token.ruleLimited === true;
                const cardStatus: "ok" | "warn" | "pending" = tradingOpen
                  ? "ok"
                  : tradingLimited
                  ? "warn"
                  : setRuleBlockedReason
                  ? "warn"
                  : "pending";
                const cardLabel = tradingOpen
                  ? "Limits removed · trading open"
                  : tradingLimited
                  ? token.ruleMaxHoldingPercent != null
                    ? `Limited · ${token.ruleMaxHoldingPercent.toFixed(2)}% max`
                    : "Limited"
                  : setRuleBlockedReason
                  ? "Needs LP first"
                  : "Ready";
                return (
                <ActionCard
                  title="3. Open trading (setRule)"
                  description="Uses the real Uniswap V2 pair address to lift the deploy-time anti-bot lock."
                  icon={Power}
                  status={cardStatus}
                  statusLabel={cardLabel}
                >
                  <p className="text-sm text-muted-foreground mb-3">
                    Most anti-bot tokens use <code className="text-foreground">setRule(_limited, pair, maxHolding, 0)</code>. This helper only enables it when a real Uniswap V2 WETH pair exists, so you don't accidentally pass a wrong pair and leave trading closed.
                  </p>

                  {/* Live on-chain rule state */}
                  {limitedKnown && (
                    <div className="mb-3 grid sm:grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                        <div className="text-muted-foreground uppercase tracking-wider mb-1">limited()</div>
                        <div className={tradingOpen ? "text-primary font-semibold" : "text-destructive font-semibold"}>
                          {tradingOpen ? "false · open" : "true · limited"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                        <div className="text-muted-foreground uppercase tracking-wider mb-1">maxHoldingAmount</div>
                        <div className="font-mono">
                          {tradingOpen
                            ? "—"
                            : token.ruleMaxHoldingPercent != null
                            ? `${token.ruleMaxHoldingPercent.toFixed(2)}% (${token.ruleMaxHoldingFormatted})`
                            : token.ruleMaxHoldingFormatted ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/40 border border-border/40 p-3">
                        <div className="text-muted-foreground uppercase tracking-wider mb-1">uniswapV2Pair</div>
                        <div className="font-mono flex items-center gap-1.5">
                          {token.ruleConfiguredPair && token.ruleConfiguredPair !== "0x0000000000000000000000000000000000000000" ? (
                            <>
                              <span>{shortAddr(token.ruleConfiguredPair)}</span>
                              <CopyBtn text={token.ruleConfiguredPair} />
                              <a href={ETHERSCAN_ADDR(token.ruleConfiguredPair)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          ) : (
                            <span className="text-muted-foreground">unset</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mismatch warning if the configured pair !== detected V2 WETH pair */}
                  {limitedKnown && tradingLimited && setRulePairAddress && token.ruleConfiguredPair && token.ruleConfiguredPair !== "0x0000000000000000000000000000000000000000" && token.ruleConfiguredPair.toLowerCase() !== setRulePairAddress.toLowerCase() && (
                    <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      The pair stored on-chain ({shortAddr(token.ruleConfiguredPair)}) does not match the detected Uniswap V2 WETH pair ({shortAddr(setRulePairAddress)}). Trading apps will revert. Re-call setRule with the correct pair.
                    </div>
                  )}

                  {setRulePairAddress ? (
                    <div className="mb-3 rounded-lg border border-border/40 bg-background/40 p-3 text-xs">
                      <div className="text-muted-foreground uppercase tracking-wider mb-1">Detected V2 pair for setRule</div>
                      <div className="flex items-center gap-2 font-mono">
                        <span>{shortAddr(setRulePairAddress)}</span>
                        <CopyBtn text={setRulePairAddress} />
                        <a href={ETHERSCAN_ADDR(setRulePairAddress)} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {setRuleBlockedReason && (
                    <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      {setRuleBlockedReason}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleOpenTrading(true)}
                      disabled={!isConnected || openingTrading || !!setRuleBlockedReason || !isOwner}
                    >
                      {openingTrading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Open with 2% max wallet
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenTrading(false)}
                      disabled={!isConnected || openingTrading || !!setRuleBlockedReason || !isOwner}
                    >
                      Remove all limits
                    </Button>
                  </div>
                  {!setRulePairAddress && (
                    <p className="text-xs text-destructive mt-2">
                      No Uniswap V2 WETH pair found. Add/fund LP first, then refresh and open trading.
                    </p>
                  )}
                  {!isOwner && token.hasOwnerFn && !token.isRenounced && (
                    <p className="text-xs text-muted-foreground mt-2">Only the contract owner can call this.</p>
                  )}
                </ActionCard>
                );
              })()}

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
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
