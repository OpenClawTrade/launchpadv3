

## Add Real $TUNA Token Data to /t/TUNA Community Page

### Problem
The `/t/TUNA` community is a "system SubTuna" with `fun_token_id = NULL`, so it doesn't display any token info (price, market cap, etc.). The actual $TUNA token has contract address `GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump` and its data should be shown on this page.

### Solution Overview
1. Create a dedicated hook to fetch $TUNA token data from DexScreener
2. Update `useSubTuna` to inject TUNA token info for the system SubTuna
3. Fix the `AgentPlatformToken` component with correct CA and links
4. Show token info widget on the `/t/TUNA` page

---

### Files to Change

| File | Purpose |
|------|---------|
| `src/hooks/useTunaTokenData.ts` | **NEW** - Hook to fetch live $TUNA data from DexScreener |
| `src/hooks/useSubTuna.ts` | Inject TUNA token data for system SubTuna |
| `src/components/agents/AgentPlatformToken.tsx` | Update with correct CA and links |
| `src/pages/SubTunaPage.tsx` | Minor - ensure token info section shows for TUNA |

---

### Implementation Details

#### 1. Create new hook `src/hooks/useTunaTokenData.ts`

This hook will fetch live $TUNA token data from DexScreener via the proxy edge function:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Official TUNA token CA
export const TUNA_TOKEN_CA = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";

interface TunaTokenData {
  price: number;        // USD price
  change24h: number;    // 24h % change
  marketCapUsd?: number;
  priceSol?: number;
}

export function useTunaTokenData() {
  return useQuery({
    queryKey: ["tuna-token-data"],
    queryFn: async (): Promise<TunaTokenData> => {
      const { data, error } = await supabase.functions.invoke(
        "dexscreener-proxy",
        { body: null, method: "GET" }
      );
      // Append token param to URL
      // ... fetch logic
    },
    staleTime: 30000, // 30 second cache
    refetchInterval: 60000, // Refresh every minute
  });
}
```

#### 2. Update `useSubTuna` hook

For the system TUNA SubTuna (where `fun_token_id` is NULL), inject hardcoded token info with the correct CA:

```typescript
// In the system SubTuna return block (around line 67-89)
// Add TUNA token info for the system SubTuna
funToken: {
  id: "tuna-platform-token",
  ticker: "TUNA",
  name: "TUNA",
  imageUrl: "/tuna-logo.png",
  mintAddress: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
  // Market cap and price will be fetched separately via useTunaTokenData
  marketCapSol: undefined,
  priceSol: undefined,
  priceChange24h: undefined,
},
```

#### 3. Update `SubTunaPage.tsx` to use live TUNA data

Import and use `useTunaTokenData` when the ticker is "TUNA" to show live price/market cap:

```typescript
// At the top of SubTunaPage
const isTunaPage = ticker?.toUpperCase() === "TUNA";
const { data: tunaLiveData } = useTunaTokenData({ enabled: isTunaPage });

// In the Token Info section, use tunaLiveData for price display
// This allows the UI to show live DexScreener data for the platform token
```

#### 4. Fix `AgentPlatformToken.tsx`

Update with correct contract address and links:

```typescript
const TUNA_TOKEN = {
  name: "$TUNA",
  description: "The TUNA platform token. Earn fees from all agent-launched tokens.",
  mintAddress: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
  dexScreenerUrl: "https://dexscreener.com/solana/GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
  solscanUrl: "https://solscan.io/token/GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
};
```

---

### Token Info Display

The `/t/TUNA` page will show:
- **Price**: Live USD/SOL price from DexScreener
- **Market Cap**: Live market cap from DexScreener  
- **24h Change**: Price change percentage
- **Trade Link**: Links to `/launchpad/GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump` or external DEX
- **Contract Address**: With copy-to-clipboard

---

### DexScreener Proxy Enhancement

The existing `dexscreener-proxy` edge function needs a small update to return more data (market cap, liquidity):

```typescript
// In the result extraction block
const result = {
  price,
  change24h,
  marketCap: pair.marketCap || pair.fdv || 0,
  liquidity: pair.liquidity?.usd || 0,
  volume24h: pair.volume?.h24 || 0,
  timestamp: Date.now(),
};
```

---

### Summary

1. **New hook** to fetch live $TUNA data from DexScreener
2. **Inject token info** for system SubTuna (TUNA community)
3. **Fix hardcoded CA** in AgentPlatformToken component
4. **Show Token Info widget** on /t/TUNA with live price data
5. **Enhance DexScreener proxy** to return market cap data

This will make the `/t/TUNA` page display accurate, live token information matching what users see on DexScreener.

