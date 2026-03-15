

## Fix: Earnings Tab Showing 0 Despite Valid Data

### Root Cause

The edge function works correctly — calling it with wallet `9knrFgvz1Q1QcD8LBLYeLJdhJ6FqE21fEeiiokX5pB7B` returns 3 tokens with 0.089 SOL total earned. The problem is in the frontend:

1. **Race condition**: `PanelEarningsTab` calls `useUserEarnings(activeAddress)` but the embedded wallet from `useSolanaWalletWithPrivy()` may not be ready when the query first fires, or fires with a stale/wrong wallet. Once React Query caches the empty result, it doesn't re-fetch even after the wallet becomes available.

2. **No `staleTime` or `refetchOnMount`** configured on the `useUserEarnings` hook — it uses defaults, so a cached empty result from a previous render persists.

3. **Wallet source inconsistency**: The unified dashboard uses `solWalletAddress || solanaAddress` (with fallback), but `PanelEarningsTab` only uses `embeddedWallet` from `useSolanaWalletWithPrivy()` with no fallback.

### Fix Plan

#### 1. `src/components/panel/PanelEarningsTab.tsx`
- Add `useAuth()` import to get `solanaAddress` as fallback
- Use `embeddedWallet || solanaAddress` as `activeAddress` (same pattern as unified dashboard)
- This ensures the correct wallet is always used

#### 2. `src/hooks/useLaunchpad.ts` — `useUserEarnings` hook
- Add `staleTime: 30_000` and `refetchInterval: 60_000` for freshness
- Ensure the query key properly invalidates when wallet changes (it already does via `queryKey: ['user-earnings', walletAddress]`)

### Also fix: `fetch-token-prices` edge function (from previous conversation)
- Add `JUPITER_API_KEY` header to the Jupiter Price API v2 call (same pattern as `jupiter-proxy`)
- This fixes the 401 error causing empty USD prices in the wallet holdings

### Files to modify

| File | Change |
|------|--------|
| `src/components/panel/PanelEarningsTab.tsx` | Add `useAuth()` fallback for wallet address |
| `src/hooks/useLaunchpad.ts` | Add staleTime/refetchInterval to useUserEarnings |
| `supabase/functions/fetch-token-prices/index.ts` | Add `JUPITER_API_KEY` header to fix 401 |

