import { safeNumber } from './utils.ts';

export async function fetchHolderCount(mintAddress: string, heliusRpcUrl: string): Promise<number> {
  if (!mintAddress || !heliusRpcUrl) return 0;

  try {
    const resp = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'fun-pool-state-holders',
        method: 'getTokenAccounts',
        params: {
          mint: mintAddress,
          limit: 1,
          page: 1,
        },
      }),
    });

    if (!resp.ok) {
      console.warn('[fun-pool-state] Helius holder count not ok:', resp.status);
      return 0;
    }

    const json = await resp.json();
    const total = safeNumber(json?.result?.total ?? 0);
    return total > 0 ? Math.floor(total) : 0;
  } catch (e) {
    console.warn('[fun-pool-state] Helius holder count error:', e);
    return 0;
  }
}
