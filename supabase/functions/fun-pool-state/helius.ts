import { safeNumber } from './utils.ts';

// Cache holder counts to reduce API calls - 60 seconds for significant credit savings
const holderCache = new Map<string, { count: number; timestamp: number }>();
const HOLDER_CACHE_TTL = 60000; // 60 seconds cache for holder counts (was 30s)

export async function fetchHolderCount(mintAddress: string, heliusRpcUrl: string): Promise<number> {
  if (!mintAddress || !heliusRpcUrl) return 0;

  // Check cache first
  const cached = holderCache.get(mintAddress);
  if (cached && Date.now() - cached.timestamp < HOLDER_CACHE_TTL) {
    return cached.count;
  }

  try {
    // Use getTokenLargestAccounts first (faster, no rate limits)
    // This gives us up to 20 largest holders which is often sufficient
    const resp = await fetch(heliusRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'fun-pool-state-holders',
        method: 'getTokenLargestAccounts',
        params: [mintAddress],
      }),
    });

    if (!resp.ok) {
      // If rate limited, return cached value if available
      if (resp.status === 429) {
        console.warn('[fun-pool-state] Rate limited on holder count, using cache');
        return cached?.count ?? 0;
      }
      console.warn('[fun-pool-state] Holder count request failed:', resp.status);
      return cached?.count ?? 0;
    }

    const json = await resp.json();
    
    // getTokenLargestAccounts returns array of accounts with non-zero balances
    const accounts = json?.result?.value || [];
    const holderCount = accounts.filter((a: { amount: string }) => 
      a.amount && parseInt(a.amount) > 0
    ).length;

    // If we got results, try to get exact count from DAS API (with longer timeout)
    if (holderCount > 0) {
      try {
        const dasResp = await fetch(heliusRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'fun-pool-state-holders-das',
            method: 'getTokenAccounts',
            params: {
              mint: mintAddress,
              limit: 1,
              page: 1,
            },
          }),
        });

        if (dasResp.ok) {
          const dasJson = await dasResp.json();
          const total = safeNumber(dasJson?.result?.total ?? 0);
          if (total > 0) {
            holderCache.set(mintAddress, { count: total, timestamp: Date.now() });
            return total;
          }
        }
      } catch {
        // DAS API failed, use the count from getTokenLargestAccounts
      }
    }

    // Cache and return the count from getTokenLargestAccounts
    holderCache.set(mintAddress, { count: holderCount, timestamp: Date.now() });
    return holderCount;
  } catch (e) {
    console.warn('[fun-pool-state] Helius holder count error:', e);
    return cached?.count ?? 0;
  }
}
