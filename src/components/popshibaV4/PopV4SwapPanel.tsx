// PopV4SwapPanel — buy/sell against OUR PopBondingHookV4.
// Pre-graduation: hook intercepts beforeSwap and runs the bonding curve.
// Post-graduation: same call routes against the locked V4 LP position.
// Either way the user submits a single Universal Router execute() call.
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
  POP_V4_UNIVERSAL_ROUTER, POP_V4_QUOTER, PERMIT2,
  POP_V4_LP_FEE, POP_V4_TICK_SPACING,
} from "@/lib/ethereum/popshibaV4";

const NATIVE_ETH: Address = "0x0000000000000000000000000000000000000000";

const CMD_V4_SWAP = 0x10;
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
  hookAddress: Address;
  tokenAddress: Address;
  symbol: string;
  graduated: boolean;
  onTraded?: () => void;
}

const SLIPPAGE = [0.5, 1, 3, 5] as const;

function buildPoolKey(token: Address, hook: Address) {
  // ETH (0x0) sorts to currency0 always.
  return {
    currency0: NATIVE_ETH,
    currency1: token,
    fee: POP_V4_LP_FEE,
    tickSpacing: POP_V4_TICK_SPACING,
    hooks: hook,
  };
}

export function PopV4SwapPanel({ hookAddress, tokenAddress, symbol, graduated, onTraded }: Props) {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const userAddr = user?.wallet?.address as Address | undefined;
  const publicClient = useMemo(() => createPublicClient({ chain: mainnet, transport: http() }) as any, []);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState<number>(graduated ? 1 : 3);
  const [busy, setBusy] = useState(false);
  const [ethBal, setEthBal] = useState<bigint>(0n);
  const [tokenBal, setTokenBal] = useState<bigint>(0n);
  const [quote, setQuote] = useState<bigint | null>(null);

  const poolKey = useMemo(() => buildPoolKey(tokenAddress, hookAddress), [tokenAddress, hookAddress]);

  useEffect(() => {
    if (!userAddr) return;
    let cancelled = false;
    const refresh = () => {
      publicClient.getBalance({ address: userAddr }).then((b: bigint) => !cancelled && setEthBal(b)).catch(() => {});
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [userAddr] })
        .then((b: any) => !cancelled && setTokenBal(b as bigint)).catch(() => {});
    };
    refresh();
    const i = setInterval(refresh, 12_000);
    return () => { cancelled = true; clearInterval(i); };
  }, [publicClient, userAddr, tokenAddress]);

  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setQuote(null); return; }
    let cancelled = false;
    const wei = (() => { try { return parseEther(amount); } catch { return null; } })();
    if (!wei) return;
    (async () => {
      try {
        const zeroForOne = side === "buy"; // ETH→TOKEN
        const out = await publicClient.simulateContract({
          address: POP_V4_QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle",
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

      if (side === "sell") {
        const allowance = await publicClient.readContract({
          address: tokenAddress, abi: ERC20_ABI, functionName: "allowance", args: [userAddr, PERMIT2],
        }) as bigint;
        if (allowance < wei) {
          toast.info("Approving token…");
          const ah = await wc.writeContract({
            account: userAddr, chain: mainnet,
            address: tokenAddress, abi: ERC20_ABI, functionName: "approve",
            args: [PERMIT2, 2n ** 256n - 1n],
          });
          await publicClient.waitForTransactionReceipt({ hash: ah });
        }
      }

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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const hash: Hash = await wc.writeContract({
        account: userAddr, chain: mainnet,
        address: POP_V4_UNIVERSAL_ROUTER, abi: ROUTER_ABI, functionName: "execute",
        args: [commands, [v4Input], deadline],
        value: side === "buy" ? wei : 0n,
      });
      toast.success("Swap sent…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") { toast.success("Swap confirmed!"); setAmount(""); onTraded?.(); }
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
    <div className="border-2 border-pop-ink bg-white shadow-[6px_6px_0_0_hsl(var(--pop-ink))] p-4 lg:sticky lg:top-24 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-pop-mono uppercase tracking-[0.12em] text-emerald-700">
          {graduated ? "Uniswap V4 · Live pool" : "Bonding curve · V4 hook"}
        </p>
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
        UNISWAP V4 · 1% FEE · POPSHIBA HOOK · LP LOCKED FOREVER
      </p>
    </div>
  );
}
