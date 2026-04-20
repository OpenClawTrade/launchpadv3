// Lightweight inline store (zustand-compatible API) — avoids extra dependency.
import { useReducer, useEffect } from 'react';

type Listener<T> = (state: T) => void;
function create<T extends object>(initializer: (set: (partial: Partial<T> | ((s: T) => Partial<T>)) => void, get: () => T) => T) {
  let state: T;
  const listeners = new Set<Listener<T>>();
  const setState = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof partial === 'function' ? (partial as (s: T) => Partial<T>)(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((l) => l(state));
  };
  const getState = () => state;
  state = initializer(setState, getState);
  function useStore(): T;
  function useStore<U>(selector: (s: T) => U): U;
  function useStore<U>(selector?: (s: T) => U): T | U {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
      const l: Listener<T> = () => force();
      listeners.add(l);
      return () => { listeners.delete(l); };
    }, []);
    return selector ? selector(state) : state;
  }
  (useStore as any).getState = getState;
  (useStore as any).setState = setState;
  return useStore as typeof useStore & { getState: () => T; setState: typeof setState };
}

export interface TradeSuccessData {
  type: 'buy' | 'sell';
  ticker: string;
  tokenName?: string;
  mintAddress?: string;
  amount?: string; // e.g. "0.5 SOL" or "100%"
  signature?: string;
  executionMs?: number;
  agentName?: string;
  tokenImageUrl?: string;
  pnlSol?: number;
  pnlPercent?: number;
  /** Chain context for explorer links */
  chain?: 'solana' | 'btc' | 'bnb';
  /** Solana proof signature for BTC trades */
  solanaProofSignature?: string;
  /** Additional explorer URL override */
  explorerUrl?: string;
}

interface TradeSuccessStore {
  isVisible: boolean;
  data: TradeSuccessData | null;
  show: (data: TradeSuccessData) => void;
  hide: () => void;
}

export const useTradeSuccessStore = create<TradeSuccessStore>((set) => ({
  isVisible: false,
  data: null,
  show: (data) => set({ isVisible: true, data }),
  hide: () => set({ isVisible: false, data: null }),
}));

/** Convenience function — call from anywhere without hooks */
export function showTradeSuccess(data: TradeSuccessData) {
  useTradeSuccessStore.getState().show(data);
}
