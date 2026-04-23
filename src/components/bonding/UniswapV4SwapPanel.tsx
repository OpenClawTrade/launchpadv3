// Post-graduation swap panel — trades the token on the Uniswap V4 pool
// that was seeded at graduation. Uses Universal Router (`execute()` w/
// V4 swap commands) so we don't need to redeploy a custom router.
//
// Flow:
//   buy  : user → V4 pool : ETH in,  TOKEN out
//   sell : user → V4 pool : TOKEN in, ETH out
//
// Quotes come from the V4 Quoter contract.
import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient, createWalletClient, custom, http,
  parseEther, formatEther, parseAbi, encodeAbiParameters, encodePacked,
  type Address, type Hash,
} from "viem";
import { mainnet } from "viem/chains";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  UNICURVE_HOOK, LP_FEE_TIER, TICK_LOWER, TICK_UPPER,
} from "@/lib/ethereum/unicurveFactory";

// Uniswap V4 mainnet contracts
const UNIVERSAL_ROUTER: Address = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
const V4_QUOTER: Address        = "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203";
const PERMIT2: Address          = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const NATIVE_ETH: Address       = "0x0000000000000000000000000000000000000000";

// Universal Router command byte for V4_SWAP
const CMD_V4_SWAP = 0x10;
// V4 pool actions
const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SETTLE_ALL           = 0x0c;
const ACTION_TAKE_ALL             = 0x0f;

const ROUTER_ABI = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
]);
const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) returns (uint256 amountOut, uint256 gasEstimate)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

interface Props {
  tokenAddress: Address;
  symbol: string;
}

const SLIPPAGE = [0.5, 1, 3] as const;

function buildPoolKey(token: Address) {
  // V4 sorts currencies; ETH = 0x0 always sorts first → currency0 = ETH, currency1 = token
  return {
    currency0: NATIVE_ETH,
    currency1: token,
    fee: LP_FEE_TIER,
    tickSpacing: 200, // matches TICK_LOWER/TICK_UPPER spacing of -887200/+887200
    hooks: UNICURVE_HOOK,
  };
}

export function UniswapV4SwapPanel({ tokenAddress, symbol }: Props) {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const userAddr = user?.wallet?.address as Address | undefined;
  const publicClient = useMemo(() => createPublicClient({ chain: mainnet, transport: http() }) as any, []);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [ethBal, setEthBal] = useState<bigint>(0n);
  const [tokenBal, setTokenBal] = useState<bigint>(0n);
  const [quote, setQuote] = useState<bigint | null>(null);

  const poolKey = useMemo(() => buildPoolKey(tokenAddress), [tokenAddress]);

  // Load balances
  useEffect(() => {
    if (!userAddr) return;
    let cancelled = false;
    (async () => {
      try {
        const [eb, tb] = await Promise.all([
          publicClient.getBalance({ address: userAddr }),
          publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddr] }),
        ]);
        if (!cancelled) { setEthBal(eb); setTokenBal(tb as bigint); }
      } catch { /* ignore */ }
    })();
    const i = setInterval(() => {
      publicClient.getBalance({ address: userAddr }).then((b: bigint) => !cancelled && setEthBal(b)).catch(() => {});
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddr] })
        .then((b: any) => !cancelled && setTokenBal(b as bigint)).catch(() => {});
    }, 12_000);
    return () => { cancelled = true; clearInterval(i); };
  }, [publicClient, userAddr, tokenAddress]);

  // Quote
  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setQuote(null); return; }
    let cancelled = false;
    const wei = (() => { try { return parseEther(amount); } catch { return null; } })();
    if (!wei) return;
    (async () => {
      try {
        // buy = ETH (currency0) → TOKEN (currency1) = zeroForOne true
        const zeroForOne = side === "buy";
        const out = await publicClient.simulateContract({
          address: V4_QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle",
          args: [poolKey, zeroForOne, wei, "0x"],
        });
        if (!cancelled) setQuote((out.result as any)[0] as bigint);
      } catch { if (!cancelled) setQuote(null); }
    })();
    return () => { cancelled = true; };
  }, [amount, side, poolKey, publicClient]);

  async function handleSwap() {
    if (!authenticated) { login(); return; }
    if (!userAddr || !amount || Number(amount) <= 0) return;
    setBusy(true);
    try {
      const wallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
      if (!wallet) throw new Error("No wallet");
      await wallet.switchChain(mainnet.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({ chain: mainnet, transport: custom(provider) }) as any;

      const wei = parseEther(amount);
      const zeroForOne = side === "buy";
      const minOut = quote ? (quote * BigInt(Math.floor((100 - slip) * 100))) / 10_000n : 0n;

      // Sells need approval to PERMIT2 → Universal Router
      if (side === "sell") {
        const allowance = await publicClient.readContract({
          address: tokenAddress, abi: ERC20_ABI, functionName: "allowance", args: [userAddr, PERMIT2],
        }) as bigint;
        if (allowance < wei) {
          toast.info("Approving token…");
          const approveHash = await wc.writeContract({
            account: userAddr, chain: mainnet,
            address: tokenAddress, abi: ERC20_ABI, functionName: "approve",
            args: [PERMIT2, 2n ** 256n - 1n],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      // Build V4 actions blob: [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
      const actions = encodePacked(
        ["uint8", "uint8", "uint8"],
        [ACTION_SWAP_EXACT_IN_SINGLE, ACTION_SETTLE_ALL, ACTION_TAKE_ALL],
      );

      const swapParams = encodeAbiParameters(
        [{
          type: "tuple",
          components: [
            { name: "poolKey", type: "tuple", components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ]},
            { name: "zeroForOne", type: "bool" },
            { name: "amountIn", type: "uint128" },
            { name: "amountOutMinimum", type: "uint128" },
            { name: "hookData", type: "bytes" },
          ],
        }],
        [{ poolKey, zeroForOne, amountIn: wei, amountOutMinimum: minOut, hookData: "0x" }],
      );

      const settleParams = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [zeroForOne ? NATIVE_ETH : tokenAddress, wei],
      );
      const takeParams = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [zeroForOne ? tokenAddress : NATIVE_ETH, minOut],
      );

      const v4Input = encodeAbiParameters(
        [{ type: "bytes" }, { type: "bytes[]" }],
        [actions, [swapParams, settleParams, takeParams]],
      );

      const commands = encodePacked(["uint8"], [CMD_V4_SWAP]);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

      const hash: Hash = await wc.writeContract({
        account: userAddr, chain: mainnet,
        address: UNIVERSAL_ROUTER, abi: ROUTER_ABI, functionName: "execute",
        args: [commands, [v4Input], deadline],
        value: side === "buy" ? wei : 0n,
      });
      toast.success("Swap sent…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") { toast.success("Swap confirmed!"); setAmount(""); }
      else throw new Error("Reverted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    } finally { setBusy(false); }
  }

  function applyPercent(p: number) {
    if (side === "buy") setAmount(formatEther((ethBal * BigInt(p)) / 100n));
    else setAmount(formatEther((tokenBal * BigInt(p)) / 100n));
  }

  return (
    <div className="border-2 border-pop-ink bg-white shadow-[3px_3px_0_hsl(var(--pop-ink))] p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-emerald-700">Uniswap V4 · Live pool</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setSide("buy")}
          className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "buy" ? "bg-emerald-500 text-pop-ink shadow-[2px_2px_0_hsl(var(--pop-ink))]" : "bg-pop-cream text-pop-ink/60"}`}>BUY</button>
        <button onClick={() => setSide("sell")}
          className={`py-2.5 font-bold text-[13px] border-2 border-pop-ink ${side === "sell" ? "bg-rose-500 text-pop-cream shadow-[2px_2px_0_hsl(var(--pop-ink))]" : "bg-pop-cream text-pop-ink/60"}`}>SELL</button>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/70">You pay</span>
        <span className="text-[10px] font-pop-mono text-pop-ink/60">
          Bal: {side === "buy" ? `${Number(formatEther(ethBal)).toFixed(4)} ETH` : `${Number(formatEther(tokenBal)).toFixed(2)} ${symbol}`}
        </span>
      </div>
      <div className="border-2 border-pop-ink bg-pop-cream/50 px-3 py-2 flex items-center gap-2">
        <input
          type="number" step="0.0001" min="0" inputMode="decimal"
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0"
          className="flex-1 bg-transparent text-[20px] font-pop-display tabular-nums focus:outline-none"
        />
        <span className="text-[12px] font-pop-mono text-pop-ink/70">{side === "buy" ? "ETH" : symbol}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} type="button" onClick={() => applyPercent(p)}
            className="py-1.5 text-[11px] font-pop-mono border border-pop-ink bg-pop-cream hover:bg-pop-orange/30">
            {p}%
          </button>
        ))}
      </div>

      {quote !== null && Number(amount) > 0 && (
        <div className="mt-3 px-3 py-2 bg-pop-cream/60 border border-pop-ink/20 text-[11px] font-pop-mono text-pop-ink/80">
          ≈ <span className="font-bold text-pop-ink">
            {side === "buy"
              ? `${Number(formatEther(quote)).toFixed(2)} ${symbol}`
              : `${Number(formatEther(quote)).toFixed(6)} ETH`}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-pop-mono uppercase tracking-[0.1em] text-pop-ink/70">Max slippage</span>
        {SLIPPAGE.map((s) => (
          <button key={s} type="button" onClick={() => setSlip(s)}
            className={`px-2 py-0.5 text-[11px] font-pop-mono border ${slip === s ? "bg-pop-ink text-pop-cream border-pop-ink" : "bg-pop-cream border-pop-ink/30 text-pop-ink/70"}`}>
            {s}%
          </button>
        ))}
      </div>

      <button
        onClick={handleSwap}
        disabled={busy || !amount}
        className="w-full mt-4 inline-flex items-center justify-center gap-2 font-bold text-[14px] px-4 py-3 border-2 border-pop-ink bg-emerald-500 text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : authenticated ? (side === "buy" ? "Swap" : "Sell") : "Connect wallet"}
      </button>

      <p className="text-[10px] font-pop-mono text-pop-ink/50 text-center mt-3">
        UNISWAP V4 · 1% POOL FEE · LP LOCKED FOREVER
      </p>
    </div>
  );
}
