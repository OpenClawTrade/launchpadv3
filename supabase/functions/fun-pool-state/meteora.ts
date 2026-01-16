import { DBC_API_URL, GRADUATION_THRESHOLD_SOL, TOTAL_SUPPLY } from './constants.ts';
import type { MeteoraReserves, PoolState } from './types.ts';
import { safeNumber } from './utils.ts';

export function computeState(params: {
  realSolReserves: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  volume24h: number;
  holderCount: number;
}): PoolState {
  const { realSolReserves, virtualSolReserves, virtualTokenReserves, volume24h, holderCount } = params;

  const priceSol = virtualTokenReserves > 0 ? virtualSolReserves / virtualTokenReserves : 0;
  const marketCapSol = priceSol * TOTAL_SUPPLY;
  const bondingProgress = Math.min((realSolReserves / GRADUATION_THRESHOLD_SOL) * 100, 100);

  return {
    priceSol: priceSol || 0.00000003,
    marketCapSol: marketCapSol || 30,
    holderCount: holderCount || 0,
    bondingProgress: bondingProgress || 0,
    realSolReserves: realSolReserves || 0,
    virtualSolReserves: virtualSolReserves || 30,
    virtualTokenReserves: virtualTokenReserves || TOTAL_SUPPLY,
    isGraduated: bondingProgress >= 100,
    volume24h: volume24h || 0,
  };
}

export async function fetchPoolFromMeteora(dbcPool: string): Promise<MeteoraReserves | null> {
  try {
    const resp = await fetch(`${DBC_API_URL}/pools/${dbcPool}`, {
      headers: { Accept: 'application/json' },
    });

    if (!resp.ok) {
      console.warn('[fun-pool-state] DBC API not ok:', resp.status);
      return null;
    }

    const data = await resp.json();

    // Meteora responses are not perfectly consistent across versions; support common shapes.
    // Preferred keys: *_sol_reserves / *_token_reserves.
    const realSolLamports = safeNumber(data.real_sol_reserves ?? data.real_quote_amount ?? data.real_quote_reserves ?? 0);
    const virtualSolLamports = safeNumber(
      data.virtual_sol_reserves ?? data.virtual_quote_amount ?? data.virtual_quote_reserves ?? 0
    );
    const virtualTokenRaw = safeNumber(data.virtual_token_reserves ?? data.virtual_base_amount ?? data.virtual_base_reserves ?? 0);

    // Fun tokens use SOL (9 decimals) and token decimals (6)
    const realSolReserves = realSolLamports / 1e9;
    const virtualSolReserves = virtualSolLamports / 1e9;
    const virtualTokenReserves = virtualTokenRaw / 1e6;

    // Basic sanity: virtual reserves should be positive
    if (virtualSolReserves <= 0 || virtualTokenReserves <= 0) {
      console.warn('[fun-pool-state] DBC API returned non-positive reserves', {
        virtualSolReserves,
        virtualTokenReserves,
      });
      return null;
    }

    return { realSolReserves, virtualSolReserves, virtualTokenReserves };
  } catch (e) {
    console.warn('[fun-pool-state] DBC API fetch error:', e);
    return null;
  }
}
