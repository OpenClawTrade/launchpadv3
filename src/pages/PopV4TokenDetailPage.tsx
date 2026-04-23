// PopShiba V4 token detail page — /popv4/:hookAddress
// Mirrors BondingTokenDetailPage but reads from PopBondingHookV4 (our hook)
// instead of the V3 curve clone, and uses UniswapV4SwapPanel-style swaps
// against OUR hook (works pre AND post graduation: hook intercepts in beforeSwap).
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { mainnet } from "viem/chains";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  POP_V4_HOOK_ABI, POP_V4_GRADUATION_THRESHOLD,
  popV4SpotEthPerToken, popV4ProgressBps,
} from "@/lib/ethereum/popshibaV4";
import { PopV4SwapPanel } from "@/components/popshibaV4/PopV4SwapPanel";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

interface TokenRow {
  id: string;
  name: string;
  symbol: string;
  token_address: string;
  curve_address: string;          // = hook address for V4
  creator_address: string;
  description: string | null;
  image_url: string | null;
  graduated: boolean;
  real_eth_reserves: number | null;
  real_token_reserves: number | null;
  progress_bps: number | null;
  price_eth: number | null;
  last_trade_at: string | null;
  total_trades: number | null;
  created_at: string;
}

interface CurveState {
  realEth: bigint;
  realTokens: bigint;
  graduated: boolean;
  creatorFees: bigint;
  protocolFees: bigint;
}

export default function PopV4TokenDetailPage() {
  const { address } = useParams<{ address: string }>();
  const hookAddr = (address ?? "").toLowerCase() as Address;
  const publicClient = useMemo(
    () => createPublicClient({ chain: mainnet, transport: http() }),
    [],
  );

  const [token, setToken] = useState<TokenRow | null>(null);
  const [state, setState] = useState<CurveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadToken = useCallback(async () => {
    if (!hookAddr.startsWith("0x")) return;
    const { data } = await supabase
      .from("bonding_tokens")
      .select("*")
      .eq("curve_address", hookAddr)
      .maybeSingle();
    setToken(data as TokenRow | null);
    setLoading(false);
  }, [hookAddr]);

  const loadState = useCallback(async () => {
    if (!hookAddr.startsWith("0x")) return;
    try {
      const [realEth, realTokens, grad, cFee, pFee] = await Promise.all([
        publicClient.readContract({ address: hookAddr, abi: POP_V4_HOOK_ABI, functionName: "realEthReserves" }),
        publicClient.readContract({ address: hookAddr, abi: POP_V4_HOOK_ABI, functionName: "realTokenReserves" }),
        publicClient.readContract({ address: hookAddr, abi: POP_V4_HOOK_ABI, functionName: "graduated" }),
        publicClient.readContract({ address: hookAddr, abi: POP_V4_HOOK_ABI, functionName: "creatorFeesAccrued" }).catch(() => 0n),
        publicClient.readContract({ address: hookAddr, abi: POP_V4_HOOK_ABI, functionName: "protocolFeesAccrued" }).catch(() => 0n),
      ]);
      setState({
        realEth: realEth as bigint,
        realTokens: realTokens as bigint,
        graduated: grad as boolean,
        creatorFees: cFee as bigint,
        protocolFees: pFee as bigint,
      });
    } catch (e) {
      console.warn("[popv4 detail] state read failed", e);
    }
  }, [hookAddr, publicClient]);

  useEffect(() => { loadToken(); }, [loadToken]);
  useEffect(() => {
    loadState();
    const i = setInterval(loadState, 15_000);
    return () => clearInterval(i);
  }, [loadState]);

  const reindex = async () => {
    setReindexing(true);
    const { data, error } = await supabase.functions.invoke("popv4-index-trades", { body: { hook: hookAddr } });
    setReindexing(false);
    if (error) { toast.error("Index failed: " + error.message); return; }
    toast.success(`Indexed ${data?.newTrades ?? 0} new trades`);
    loadToken(); loadState();
  };

  const triggerSeed = async () => {
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("popv4-seed-lp", { body: { hook: hookAddr } });
    setSeeding(false);
    if (error) { toast.error("Seed failed: " + error.message); return; }
    toast.success("LP seeded! tx: " + (data?.txHash ?? "").slice(0, 10) + "…");
    loadToken(); loadState();
  };

  const progressBps = state ? popV4ProgressBps(state.realEth) : (token?.progress_bps ?? 0);
  const spotPriceWei = state ? popV4SpotEthPerToken(state.realEth, state.realTokens) : 0n;
  const spotPriceEth = Number(spotPriceWei) / 1e18;
  const realEthEth = state ? Number(formatEther(state.realEth)) : (token?.real_eth_reserves ?? 0);

  if (loading) {
    return (
      <LaunchpadLayout>
        <div className="mx-auto max-w-5xl py-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-pop-ink/60" />
        </div>
      </LaunchpadLayout>
    );
  }

  if (!token) {
    return (
      <LaunchpadLayout>
        <div className="mx-auto max-w-5xl py-12">
          <Link to="/popv4" className="text-[12px] font-pop-display text-pop-ink/60 hover:text-pop-ink inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> All PopShiba V4 launches
          </Link>
          <div className="mt-6 border-2 border-pop-ink bg-pop-cream p-6 rounded-2xl">
            <div className="text-pop-ink font-pop-display font-black text-xl">Hook not found</div>
            <div className="text-pop-ink/70 text-[13px] mt-1 break-all">{hookAddr}</div>
            <div className="text-pop-ink/70 text-[13px] mt-3">
              If you just launched this token, the indexer hasn't caught it yet. Try the reindex button below.
            </div>
            <button
              onClick={reindex}
              disabled={reindexing}
              className="mt-4 inline-flex items-center gap-2 border-2 border-pop-ink bg-white px-3 py-2 text-[12px] font-pop-display font-bold shadow-[3px_3px_0_hsl(var(--pop-ink))]"
            >
              {reindexing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reindex from chain
            </button>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  return (
    <LaunchpadLayout>
      <div className="mx-auto max-w-6xl py-6 md:py-10">
        <Link to="/popv4" className="text-[12px] font-pop-display text-pop-ink/60 hover:text-pop-ink inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> All PopShiba V4
        </Link>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: token info */}
          <div className="lg:col-span-8 space-y-4">
            <div className="border-2 border-pop-ink bg-white p-5 rounded-2xl shadow-[6px_6px_0_0_hsl(var(--pop-ink))]">
              <div className="flex items-start gap-4">
                {token.image_url ? (
                  <img src={token.image_url} alt={token.symbol} className="w-20 h-20 rounded-xl border-2 border-pop-ink object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-pop-ink bg-pop-orange flex items-center justify-center font-pop-display font-black text-2xl text-pop-ink">
                    {token.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-pop-display font-black text-pop-ink leading-none">{token.name}</h1>
                    <span className="text-[12px] font-pop-mono text-pop-ink/60">${token.symbol}</span>
                    {state?.graduated && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-pop-display">
                        graduated
                      </span>
                    )}
                  </div>
                  {token.description && (
                    <p className="mt-1.5 text-[13px] text-pop-ink/75 leading-snug">{token.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-pop-mono text-pop-ink/60 flex-wrap">
                    <a href={`https://etherscan.io/address/${token.token_address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-pop-ink">
                      Token <ExternalLink className="h-3 w-3" />
                    </a>
                    <a href={`https://etherscan.io/address/${hookAddr}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-pop-ink">
                      Hook <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-pop-ink/40">·</span>
                    <span>{token.total_trades ?? 0} trades</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Curve stats */}
            <div className="border-2 border-pop-ink bg-pop-cream p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="font-pop-display font-black text-pop-ink">Bonding curve</div>
                <button
                  onClick={reindex}
                  disabled={reindexing}
                  className="inline-flex items-center gap-1 text-[11px] font-pop-display text-pop-ink/70 hover:text-pop-ink"
                >
                  {reindexing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Reindex
                </button>
              </div>

              <div className="h-3 w-full bg-white border-2 border-pop-ink rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, progressBps / 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-pop-mono text-pop-ink/70">
                <span>{(progressBps / 100).toFixed(2)}% to graduation</span>
                <span>{realEthEth.toFixed(4)} / 3 ETH</span>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Spot price" value={`${spotPriceEth.toExponential(3)} ETH`} />
                <Stat label="ETH reserves" value={`${realEthEth.toFixed(4)}`} />
                <Stat label="Tokens left" value={state ? Number(formatEther(state.realTokens)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"} />
                <Stat label="Creator fees (unclaimed)" value={state ? `${Number(formatEther(state.creatorFees)).toFixed(5)} ETH` : "—"} />
              </div>

              {state?.graduated && (
                <div className="mt-4 border-2 border-emerald-700 bg-white p-3 rounded">
                  <div className="font-pop-display font-bold text-emerald-800 text-[13px]">Graduated — LP not yet seeded?</div>
                  <p className="text-[12px] text-pop-ink/70 mt-0.5">
                    Anyone can trigger the LP seed. We'll pay gas. After seeding, swaps route through the V4 pool with locked LP.
                  </p>
                  <button
                    onClick={triggerSeed}
                    disabled={seeding}
                    className="mt-2 inline-flex items-center gap-2 border-2 border-pop-ink bg-emerald-500 text-pop-ink px-3 py-2 text-[12px] font-pop-display font-bold shadow-[3px_3px_0_hsl(var(--pop-ink))]"
                  >
                    {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Seed locked LP
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: swap */}
          <div className="lg:col-span-4">
            <PopV4SwapPanel
              hookAddress={hookAddr}
              tokenAddress={token.token_address as Address}
              symbol={token.symbol}
              graduated={state?.graduated ?? token.graduated}
              onTraded={() => { loadState(); reindex(); }}
            />
          </div>
        </div>
      </div>
    </LaunchpadLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border-2 border-pop-ink rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-pop-ink/55 font-pop-display">{label}</div>
      <div className="mt-0.5 font-pop-display font-bold text-pop-ink text-[14px] tabular-nums">{value}</div>
    </div>
  );
}
