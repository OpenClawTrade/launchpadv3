import { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useGraduatedTokens } from "@/hooks/useGraduatedTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useBnbPrice } from "@/hooks/useBnbPrice";
import { useCodexNewPairs, ETH_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { useProTradersCount } from "@/hooks/useProTradersCount";
import { AxiomTerminalGrid } from "@/components/launchpad/AxiomTerminalGrid";
import { useTradeSounds } from "@/hooks/useTradeSounds";
import { useChain } from "@/contexts/ChainContext";
import {
  List, Settings, Bookmark, Monitor, Volume2, VolumeX, LayoutGrid, ChevronDown, Zap
} from "lucide-react";

const QUICK_BUY_KEY = "pulse-quick-buy-amount";
const DEFAULT_QUICK_BUY_SOL = 0.5;
const DEFAULT_QUICK_BUY_BNB = 0.01;

function getQuickBuyStorageKey(isBnb = false) {
  return isBnb ? `${QUICK_BUY_KEY}-bnb` : QUICK_BUY_KEY;
}

function getStoredQuickBuy(isBnb = false): number {
  try {
    const v = localStorage.getItem(getQuickBuyStorageKey(isBnb));
    if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
  } catch {}
  return isBnb ? DEFAULT_QUICK_BUY_BNB : DEFAULT_QUICK_BUY_SOL;
}

export default function TradePage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const { chain, chainConfig } = useChain();

  const isBnb = chain === 'bnb';
  const networkId = isBnb ? BSC_NETWORK_ID : ETH_NETWORK_ID;
  const nativeCurrency = chainConfig.nativeCurrency.symbol;
  const quickBuyStorageKey = getQuickBuyStorageKey(isBnb);

  // Solana DB tokens (only when on Solana)
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(1, 100);
  const { tokens: graduatedTokens } = useGraduatedTokens();

  // Prices
  const { solPrice } = useSolPrice();
  const { bnbPrice } = useBnbPrice();
  const activePrice = isBnb ? bnbPrice : solPrice;

  // Codex data — chain-aware
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated } = useCodexNewPairs(networkId);

  const [quickBuyAmount, setQuickBuyAmount] = useState(() => getStoredQuickBuy(isBnb));
  const [quickBuyInput, setQuickBuyInput] = useState(() => String(getStoredQuickBuy(isBnb)));
  const { toggle: toggleSounds, isEnabled: isSoundsEnabled } = useTradeSounds();
  const [soundsOn, setSoundsOn] = useState(() => localStorage.getItem("pulse-sounds-enabled") === "true");

  useEffect(() => {
    const nextAmount = getStoredQuickBuy(isBnb);
    setQuickBuyAmount(nextAmount);
    setQuickBuyInput(String(nextAmount));
  }, [isBnb]);

  const handleQuickBuyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setQuickBuyInput(val);
      const num = parseFloat(val);
      if (num > 0 && isFinite(num)) {
        setQuickBuyAmount(num);
        localStorage.setItem(quickBuyStorageKey, String(num));
      }
    }
  }, [quickBuyStorageKey]);

  const handleQuickBuySet = useCallback((amount: number) => {
    setQuickBuyAmount(amount);
    setQuickBuyInput(String(amount));
    localStorage.setItem(quickBuyStorageKey, String(amount));
  }, [quickBuyStorageKey]);

  // Ethereum-only: always merge DB tokens; Codex (Solana/BSC) is disabled
  const allTokens = useMemo(() => {
    const tokenIds = new Set(tokens.map(t => t.id));
    const missingGraduated = graduatedTokens.filter(t => !tokenIds.has(t.id));
    return [...tokens, ...missingGraduated];
  }, [tokens, graduatedTokens]);

  const mintAddresses = useMemo(() => allTokens.map(t => t.mint_address).filter(Boolean) as string[], [allTokens]);
  const { data: proTradersMap } = useProTradersCount(mintAddresses);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTokens;
    const q = search.toLowerCase();
    return allTokens.filter(t =>
      t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q)
    );
  }, [allTokens, search]);

  const displayCount = totalCount;

  return (
    <LaunchpadLayout hideFooter hideTicker noPadding>
      <div className="space-y-0 relative z-10 bg-pop-cream min-h-screen">
        {/* Pulse Header Toolbar — Poster style */}
        <div className="flex items-center justify-between px-4 py-3 bg-pop-orange border-b-[3px] border-pop-ink">
          <div className="flex items-center gap-2">
            <h1 className="font-pop-display text-lg uppercase text-pop-ink tracking-tight leading-none">
              Pulse {isBnb ? '· BNB' : ''}
            </h1>
            <button className="p-1.5 bg-pop-cream pop-border rounded-md text-pop-ink hover:-translate-y-[1px] transition-transform">
              <List className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button className="p-1.5 bg-pop-cream pop-border rounded-md text-pop-ink hover:-translate-y-[1px] transition-transform">
              <Settings className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1 px-2 py-1.5 bg-pop-cream pop-border rounded-md font-pop-mono text-[10px] uppercase text-pop-ink hover:-translate-y-[1px] transition-transform">
              <span>Display</span>
              <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
            </button>
            <button className="p-1.5 bg-pop-cream pop-border rounded-md text-pop-ink hover:-translate-y-[1px] transition-transform">
              <Bookmark className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button className="p-1.5 bg-pop-cream pop-border rounded-md text-pop-ink hover:-translate-y-[1px] transition-transform hidden md:inline-flex">
              <Monitor className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button
              className={`p-1.5 pop-border rounded-md hover:-translate-y-[1px] transition-transform ${soundsOn ? "bg-pop-ink text-pop-orange" : "bg-pop-cream text-pop-ink"}`}
              onClick={() => { toggleSounds(); setSoundsOn(!soundsOn); }}
              title={soundsOn ? "Mute trade sounds" : "Enable trade sounds"}
            >
              {soundsOn ? <Volume2 className="h-3.5 w-3.5" strokeWidth={2.5} /> : <VolumeX className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </button>
            <button className="p-1.5 bg-pop-cream pop-border rounded-md text-pop-ink hover:-translate-y-[1px] transition-transform hidden md:inline-flex">
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <div className="hidden sm:flex items-center gap-1 ml-1 px-2 py-1.5 rounded-md bg-pop-ink text-pop-orange font-pop-mono text-[10px] pop-border">
              <span className="font-bold">1</span>
              <span>=</span>
              <span>{displayCount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {search && (
          <div className="px-4 py-2 bg-pop-cream border-b-2 border-pop-ink/20">
            <span className="font-pop-mono text-[11px] text-pop-ink uppercase">
              Filtering: <span className="font-bold">"{search}"</span>
            </span>
          </div>
        )}

        {/* Axiom Terminal Grid */}
        <AxiomTerminalGrid
          tokens={filtered}
          solPrice={activePrice}
          isLoading={isLoading}
          codexNewPairs={codexNewPairs}
          codexCompleting={codexCompleting}
          codexGraduated={codexGraduated}
          quickBuyAmount={quickBuyAmount}
          onQuickBuyChange={handleQuickBuySet}
          proTradersMap={proTradersMap ?? {}}
          chain={chain}
          networkId={networkId}
          nativeCurrency={nativeCurrency}
        />
      </div>
    </LaunchpadLayout>
  );
}
