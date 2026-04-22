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
import { supabase } from "@/integrations/supabase/client";

const CURRENT_LAUNCHNOW_RUNTIME =
  "608060405234801561001057600080fd5b506004361061012c5760003560e01c806349bd5a5e116100ad5780638da5cb5b116100715780638da5cb5b1461027f57806395d89b4114610290578063a9059cbb14610298578063dd62ed3e146102ab578063f2fde38b146102e457600080fd5b806349bd5a5e1461020d57806370a0823114610238578063715018a614610261578063860a32ec1461026957806389f9a1d31461027657600080fd5b806323b872dd116100f457806323b872dd146101b0578063313ce567146101c35780633aa633aa146101d2578063404e5129146101e757806342966c68146101fa57600080fd5b806306fdde0314610131578063095ea7b31461014f57806316c021291461017257806318160ddd146101955780631ab99e12146101a7575b600080fd5b6101396102f7565b6040516101469190610c6e565b60405180910390f35b61016261015d366004610cd8565b610389565b6040519015158152602001610146565b610162610180366004610d02565b600a6020526000908152604090205460ff1681565b6003545b604051908152602001610146565b61019960085481565b6101626101be366004610d24565b6103a0565b60405160128152602001610146565b6101e56101e0366004610d71565b61044c565b005b6101e56101f5366004610db3565b6104b1565b6101e5610208366004610de6565b610506565b600954610220906001600160a01b031681565b6040516001600160a01b039091168152602001610146565b610199610246366004610d02565b6001600160a01b031660009081526001602052604090205490565b6101e5610513565b6006546101629060ff1681565b61019960075481565b6000546001600160a01b0316610220565b610139610549565b6101626102a6366004610cd8565b610558565b6101996102b9366004610dff565b6001600160a01b03918216600090815260026020908152604080832093909416825291909152205490565b6101e56102f2366004610d02565b610565565b60606004805461030690610e29565b80601f016020809104026020016040519081016040528092919081815260200182805461033290610e29565b801561037f5780601f106103545761010080835404028352916020019161037f565b820191906000526020600020905b81548152906001019060200180831161036257829003601f168201915b5050505050905090565b60006103963384846105fd565b5060015b92915050565b6001600160a01b0383166000908152600260209081526040808320338452909152812054600019811461043657828110156104225760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e636500000060448201526064015b60405180910390fd5b61043685336104318685610e79565b6105fd565b610441858585610722565b506001949350505050565b6000546001600160a01b031633146104765760405162461bcd60e51b815260040161041990610e8c565b6006805460ff191694151594909417909355600980546001600160a01b0319166001600160a01b039390931692909217909155600755600855565b6000546001600160a01b031633146104db5760405162461bcd60e51b815260040161041990610e8c565b6001600160a01b03919091166000908152600a60205260409020805460ff1916911515919091179055565b6105103382610905565b50565b6000546001600160a01b0316331461053d5760405162461bcd60e51b815260040161041990610e8c565b6105476000610a60565b565b60606005805461030690610e29565b6000610396338484610722565b6000546001600160a01b0316331461058f5760405162461bcd60e51b815260040161041990610e8c565b6001600160a01b0381166105f45760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b6064820152608401610419565b61051081610a60565b6001600160a01b03831661065f5760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b6064820152608401610419565b6001600160a01b0382166106c05760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b6064820152608401610419565b6001600160a01b0383811660008181526002602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92591015b60405180910390a3505050565b6001600160a01b0383166107865760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b6064820152608401610419565b6001600160a01b0382166107e85760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b6064820152608401610419565b6107f3838383610ab0565b6001600160a01b0383166000908152600160205260409020548181101561086b5760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b6064820152608401610419565b6108758282610e79565b6001600160a01b0380861660009081526001602052604080822093909355908516815290812080548492906108ab908490610ec1565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516108f791815260200190565b60405180910390a350505050565b6001600160a01b0382166109655760405162461bcd60e51b815260206004820152602160248201527f45524332303a206275726e2066726f6d20746865207a65726f206164647265736044820152607360f81b6064820152608401610419565b61097182600083610ab0565b6001600160a01b038216600090815260016020526040902054818110156109e55760405162461bcd60e51b815260206004820152602260248201527f45524332303a206275726e20616d6f756e7420657863656564732062616c616e604482015261636560f01b6064820152608401610419565b6109ef8282610e79565b6001600160a01b03841660009081526001602052604081209190915560038054849290610a1d908490610e79565b90915550506040518281526000906001600160a01b038516907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90602001610715565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6001600160a01b0382166000908152600a602052604090205460ff16158015610af257506001600160a01b0383166000908152600a602052604090205460ff16155b610b2c5760405162461bcd60e51b815260206004820152600b60248201526a109b1858dadb1a5cdd195960aa1b6044820152606401610419565b6009546001600160a01b0316610baf576000546001600160a01b0384811691161480610b6557506000546001600160a01b038381169116145b610baa5760405162461bcd60e51b81526020600482015260166024820152751d1c98591a5b99c81a5cc81b9bdd081cdd185c9d195960521b6044820152606401610419565b505050565b60065460ff168015610bce57506009546001600160a01b038481169116145b15610baa5760075481610bf6846001600160a01b031660009081526001602052604090205490565b610c009190610ec1565b11158015610c39575060085481610c2c846001600160a01b031660009081526001602052604090205490565b610c369190610ec1565b10155b610baa5760405162461bcd60e51b8152602060048201526006602482015265119bdc989a5960d21b6044820152606401610419565b602081526000825180602084015260005b81811015610c9c5760208186018101516040868401015201610c7f565b506000604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b0381168114610cd357600080fd5b919050565b60008060408385031215610ceb57600080fd5b610cf483610cbc565b946020939093013593505050565b600060208284031215610d1457600080fd5b610d1d82610cbc565b9392505050565b600080600060608486031215610d3957600080fd5b610d4284610cbc565b9250610d5060208501610cbc565b929592945050506040919091013590565b80358015158114610cd357600080fd5b60008060008060808587031215610d8757600080fd5b610d9085610d61565b9350610d9e60208601610cbc565b93969395505050506040820135916060013590565b60008060408385031215610dc657600080fd5b610dcf83610cbc565b9150610ddd60208401610d61565b90509250929050565b600060208284031215610df857600080fd5b5035919050565b60008060408385031215610e1257600080fd5b610e1b83610cbc565b9150610ddd60208401610cbc565b600181811c90821680610e3d57607f821691505b602082108103610e5d57634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052601160045260246000fd5b8181038181111561039a5761039a610e63565b6020808252818101527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604082015260600190565b8082018082111561039a5761039a610e6356fea2646970667358221220e3bb07976b0c7285b7c8806dac255307bc793d1532b19fab6232cab18f0c7ad664736f6c634300081c0033";

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
  // Auto-verify status for the just-deployed contract
  const [autoVerifyStatus, setAutoVerifyStatus] = useState<"idle" | "submitting" | "polling" | "ok" | "fail">("idle");
  const [autoVerifyMsg, setAutoVerifyMsg] = useState<string>("");
  const [autoVerifiedAddr, setAutoVerifiedAddr] = useState<string | null>(null);

  // Shared verify runner — used by both post-deploy auto-verify and the manual "Verify now" button.
  const runVerify = async (params: {
    tokenAddress: string;
    name: string;
    symbol: string;
    totalSupply: string;
    header?: string;
    source: "auto" | "manual";
  }) => {
    setAutoVerifiedAddr(params.tokenAddress);
    setAutoVerifyStatus("submitting");
    setAutoVerifyMsg(
      params.source === "auto"
        ? "Waiting for Etherscan to index the contract…"
        : "Submitting source to Etherscan…"
    );
    toast.info(params.source === "auto" ? "Auto-verifying on Etherscan…" : "Verifying on Etherscan…");
    try {
      const { data, error } = await supabase.functions.invoke("pepe-verify-launchnow", {
        body: {
          tokenAddress: params.tokenAddress,
          name: params.name,
          symbol: params.symbol,
          totalSupply: params.totalSupply,
          header: params.header ?? deployHeader,
          waitForResult: true,
        },
      });
      if (error) throw error;
      if (data?.verified) {
        setAutoVerifyStatus("ok");
        setAutoVerifyMsg(data.alreadyVerified ? "Already verified" : "Verified ✓");
        toast.success("Contract verified on Etherscan ✓");
      } else {
        setAutoVerifyStatus("fail");
        setAutoVerifyMsg(String(data?.error || data?.message || "Verification failed"));
        toast.error(`Verify failed: ${data?.error || data?.message || "unknown"}`);
      }
    } catch (err: any) {
      console.error("[verify]", err);
      setAutoVerifyStatus("fail");
      setAutoVerifyMsg(err?.message || "Verification error");
      toast.error(`Verify error: ${err?.message || "unknown"}`);
    }
  };

  const { address, isConnected, connect, disconnect, logout, balance, isOnEthereum, switchToEthereum } = useEvmWallet();
  const { data: walletClient } = useWalletClient({ chainId: mainnet.id });
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();

  const { data: token, isLoading, refetch, isFetching } = useTokenInspector(activeCA, address);
  const { data: heldTokens, isLoading: heldLoading, refetch: refetchHeld } = useWalletTokens(address);
  const [isVerifyCompatible, setIsVerifyCompatible] = useState<boolean | null>(null);

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

        // 🔥 Auto-verify on Etherscan (fire-and-forget)
        runVerify({
          tokenAddress: ca,
          name,
          symbol,
          totalSupply: totalSupplyWei.toString(),
          header: deployHeader,
          source: "auto",
        });
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

  /* -------------------------- Action: Remove LP (1 tx, EIP-2612 permit) -------------------------- */
  const [removingLp, setRemovingLp] = useState(false);
  const handleRemoveLp = async () => {
    if (!walletClient || !address || !token?.pairAddress || !token.userLpBalance) return;
    if (token.userLpBalance === 0n) {
      toast.error("You don't hold any LP tokens");
      return;
    }
    if (!confirm("Remove ALL your liquidity in 1 transaction? Uses max slippage so it lands instantly.")) return;
    if (!(await ensureChain())) return;
    setRemovingLp(true);
    try {
      const liquidity = token.userLpBalance;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30);

      const { createPublicClient, http } = await import("viem");
      const pc = createPublicClient({ chain: mainnet, transport: http() });

      // Read pair name + current nonce for the EIP-2612 permit signature
      toast.info("Preparing permit signature…");
      const [pairName, nonce] = await Promise.all([
        pc.readContract({ address: token.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "name" } as any) as Promise<string>,
        pc.readContract({ address: token.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "nonces", args: [address as Address] } as any) as Promise<bigint>,
      ]);

      // EIP-712 typed data — Uniswap V2 LP tokens implement EIP-2612
      const domain = {
        name: pairName,
        version: "1",
        chainId: 1,
        verifyingContract: token.pairAddress,
      } as const;
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      } as const;
      const message = {
        owner: address as Address,
        spender: UNISWAP_V2_ROUTER,
        value: liquidity,
        nonce,
        deadline,
      };

      const signature = await walletClient.signTypedData({
        account: address as Address,
        domain,
        types,
        primaryType: "Permit",
        message,
      });

      // Split sig into r, s, v
      const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
      const r = ("0x" + sig.slice(0, 64)) as `0x${string}`;
      const s = ("0x" + sig.slice(64, 128)) as `0x${string}`;
      let v = parseInt(sig.slice(128, 130), 16);
      if (v < 27) v += 27;

      // Suggest aggressive gas — fetch current basefee + tip a fat priority fee
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      try {
        const block = await pc.getBlock();
        const baseFee = block.baseFeePerGas ?? 1_000_000_000n;
        // 20 gwei priority tip — guarantees fast inclusion
        maxPriorityFeePerGas = 20_000_000_000n;
        // 2x basefee + tip — handles spikes, refunds the rest
        maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
        const totalGwei = Number(maxFeePerGas / 1_000_000_000n);
        toast.info(`Submitting at ~${totalGwei} gwei (priority +20 gwei) for instant inclusion…`);
      } catch {
        // fallback: let the wallet decide
      }

      // Single tx: permit + remove with max slippage (0,0 = accept any output)
      const hash = await walletClient.writeContract({
        account: address as Address,
        chain: mainnet,
        address: UNISWAP_V2_ROUTER,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: "removeLiquidityETHWithPermitSupportingFeeOnTransferTokens",
        args: [token.address, liquidity, 0n, 0n, address as Address, deadline, false, v, r, s],
        ...(maxFeePerGas && maxPriorityFeePerGas ? { maxFeePerGas, maxPriorityFeePerGas } : {}),
      } as any);

      toast.success(
        <a href={ETHERSCAN_TX(hash)} target="_blank" rel="noopener noreferrer" className="underline">
          Liquidity removed in 1 tx — view
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

              {/* ---- Solidity header comment editor ---- */}
              <div className="mt-5">
                <Label htmlFor="d-header" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Solidity header comment (top of contract source)
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  These <code>//</code> lines are prepended to the verified Solidity source shown on Etherscan after you verify. They don't change the bytecode — pure on-source signature / shoutout block.
                </p>
                <textarea
                  id="d-header"
                  value={deployHeader}
                  onChange={(e) => setDeployHeader(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder={"// Comment here\n// Comment here\n// Comment here"}
                  className="mt-2 w-full rounded-md border border-border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <div className="mt-2 rounded-md border border-border/40 bg-background/60 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
                  <div className="text-muted-foreground mb-1">// preview — top of TokenName.sol</div>
                  <pre className="whitespace-pre-wrap text-foreground/90">
{(deployHeader.trim()
  ? deployHeader
      .split("\n")
      .map((l) => {
        const t = l.trim();
        if (!t) return "//";
        return t.startsWith("//") ? t : `// ${t}`;
      })
      .join("\n") + "\n"
  : "")}{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${deploySymbol || "TOKEN"} { /* ... */ }`}
                  </pre>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        deployHeader
                          .split("\n")
                          .map((l) => {
                            const t = l.trim();
                            if (!t) return "//";
                            return t.startsWith("//") ? t : `// ${t}`;
                          })
                          .join("\n")
                      );
                      toast.success("Header copied — paste at the top of the source on Etherscan");
                    }}
                    className="px-2 py-1 rounded border border-border/40 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy header
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeployHeader("")}
                    className="px-2 py-1 rounded border border-border/40 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
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
              {(() => {
                const isJustDeployed =
                  autoVerifiedAddr && token.address.toLowerCase() === autoVerifiedAddr.toLowerCase();
                const showAutoStatus = isJustDeployed && autoVerifyStatus !== "idle" && verifyState !== "ok";
                const cardStatus =
                  verifyState === "ok"
                    ? "ok"
                    : showAutoStatus
                    ? autoVerifyStatus === "ok"
                      ? "ok"
                      : autoVerifyStatus === "fail"
                      ? "warn"
                      : "pending"
                    : verifyState;
                const cardLabel =
                  verifyState === "ok"
                    ? "Verified"
                    : showAutoStatus
                    ? autoVerifyStatus === "ok"
                      ? "Verified"
                      : autoVerifyStatus === "fail"
                      ? "Auto-verify failed"
                      : autoVerifyStatus === "submitting"
                      ? "Submitting…"
                      : "Polling Etherscan…"
                    : verifyState === "pending"
                    ? "Not verified"
                    : "Unknown";
                return (
                  <ActionCard
                    title="1. Verify on Etherscan"
                    description="Auto-runs right after deploy. Falls back to manual link if it fails."
                    icon={ShieldCheck}
                    status={cardStatus as any}
                    statusLabel={cardLabel}
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
                    ) : showAutoStatus && autoVerifyStatus !== "fail" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{autoVerifyMsg || "Verifying…"}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {showAutoStatus && autoVerifyStatus === "fail" && (
                          <p className="text-xs text-destructive font-mono break-all">{autoVerifyMsg}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            disabled={autoVerifyStatus === "submitting" || autoVerifyStatus === "polling"}
                            onClick={() =>
                              runVerify({
                                tokenAddress: token.address,
                                name: token.name,
                                symbol: token.symbol,
                                totalSupply: token.totalSupply.toString(),
                                source: "manual",
                              })
                            }
                          >
                            {autoVerifyStatus === "submitting" || autoVerifyStatus === "polling" ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Verifying…
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4" />
                                Verify now
                              </>
                            )}
                          </Button>
                          <Button asChild variant="outline">
                            <a href={ETHERSCAN_VERIFY(token.address)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              Open Etherscan verifier
                            </a>
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Auto-verify only works for tokens launched after the latest contract update. Older tokens may need the manual verifier.
                        </p>
                      </div>
                    )}
                  </ActionCard>
                );
              })()}

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
