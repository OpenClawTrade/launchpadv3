

## Plan: BNB 1-Click Trading via 1inch + Unified Alpha Tracker

The approved plan was never implemented. Here is the concrete implementation plan.

### Pre-requisite: 1inch API Key

A `ONEINCH_API_KEY` secret is needed. Free from [portal.1inch.dev](https://portal.1inch.dev). I will use `add_secret` to request it before proceeding with code.

---

### 1. Database Migration — Add `chain` column to `alpha_trades`

```sql
ALTER TABLE alpha_trades ADD COLUMN chain TEXT NOT NULL DEFAULT 'solana';
CREATE INDEX idx_alpha_trades_chain ON alpha_trades(chain);
```

This lets BNB and Solana trades coexist in one table/feed.

### 2. New Edge Function: `bnb-dex-swap/index.ts`

Server-side 1-click swap for BNB tokens (no wallet prompts — uses deployer key like Solana's `server-trade`).

- Accepts: `{ tokenAddress, action, amount, userWallet }`
- For **bonding curve tokens**: calls existing Portal contract buy/sell (reuse `bnb-swap` logic)
- For **graduated/external tokens**: calls 1inch Swap API v6 (`GET /swap/v6.0/56/swap`) to get calldata, then signs+broadcasts via deployer key using viem
- Records trade in `alpha_trades` with `chain = 'bnb'`
- Uses `ONEINCH_API_KEY`, `BASE_DEPLOYER_PRIVATE_KEY`

### 3. New Hook: `src/hooks/useBnbFastSwap.ts`

Mirrors `useFastSwap` interface:
- `{ executeFastSwap, isLoading, lastLatencyMs, walletAddress }`
- Calls `bnb-dex-swap` edge function via `supabase.functions.invoke()`
- Returns `{ success, signature (txHash) }`
- No wallet signing — fully server-side

### 4. Update `PulseQuickBuyButton.tsx`

Replace the static PancakeSwap link (lines 106-121) with a `BnbQuickBuy` component:
- Same UI as `SolanaQuickBuy`: preset amounts (0.1, 0.5, 1, 2 BNB), popover, sell-100%
- Uses `useBnbFastSwap` hook
- BscScan TX links on success toasts

### 5. Update `bnb-swap/index.ts`

Add `alpha_trades` insert after successful bonding curve trade (matching `launchpad-swap` pattern) with `chain = 'bnb'`.

### 6. Update `useAlphaTrades.ts` — Unified Feed

- Remove any chain filtering — fetch ALL trades (both chains)
- Add `chain` field to `AlphaTrade` interface
- No changes to realtime subscription (it already listens to all inserts)

### 7. Update `AlphaTrackerPage.tsx` — Unified Multi-Chain

- **Remove** the "BNB Chain tracking coming soon" yellow banner (lines 86-93)
- Add a small chain icon/badge per trade row (SOL or BNB icon)
- Explorer links already dynamic (line 59-62) — works as-is
- Add chain filter button to filter panel (SOL / BNB / ALL)

### 8. Update Agent Staking (`TradingAgentsShowcase`) — Chain-Aware

- When BNB chain active: show "Stake BNB" instead of "Stake SOL"
- Update amount labels to BNB denomination

### Files to create (2)
- `supabase/functions/bnb-dex-swap/index.ts`
- `src/hooks/useBnbFastSwap.ts`

### Files to modify (6)
- `src/components/launchpad/PulseQuickBuyButton.tsx`
- `src/hooks/useAlphaTrades.ts`
- `src/pages/AlphaTrackerPage.tsx`
- `supabase/functions/bnb-swap/index.ts`
- `src/components/trading/TradingAgentsShowcase.tsx`
- `src/components/home/TradingAgentsShowcase.tsx`

### 1 database migration

