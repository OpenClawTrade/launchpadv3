

# Unified Fee Calculation System — Plan

## Problem

The fee model is simple: **platform always takes 1% (100 bps), creator chooses their own additional fee via slider**. The on-chain `trading_fee_bps = creator_fee_bps + 100`. So the correct creator share of any claimed fees is always:

```
creator_share = creator_fee_bps / trading_fee_bps
platform_share = 1 - creator_share (always = 100 / trading_fee_bps)
```

But **5 edge functions** use wrong hardcoded ratios instead of reading the token's actual bps:

| Function | Hardcoded Share | Should Be |
|---|---|---|
| `fun-distribute` (legacy path) | 50% creator | `creator_fee_bps / trading_fee_bps` |
| `fun-distribute` (agent path) | 30% creator / 30% agent / 40% platform | Same formula per token |
| `fun-distribute` (API path) | 50% / 50% | Same formula per token |
| `fun-distribute` (punch path) | 70% / 30% | Same formula per token |
| `claw-creator-claim` | 30% creator | `creator_fee_bps / trading_fee_bps` |
| `claw-distribute` | 30% creator | `creator_fee_bps / trading_fee_bps` |
| `agent-find-by-twitter` | 80% creator | `creator_fee_bps / trading_fee_bps` |

**Example of real impact**: Madtopus has `creator_fee_bps=90, trading_fee_bps=190`, so creator should get **47.4%**. But `claw-creator-claim` gives 30%, and `fun-distribute` legacy gives 50%. Neither is correct.

## Current Token Data (Confirmation)

| Token | creator_fee_bps | trading_fee_bps | Correct Creator % | Correct Platform % |
|---|---|---|---|---|
| PEX | 100 | 200 | 50.0% | 50.0% |
| SHROO | 10 | 110 | 9.1% | 90.9% |
| DGG | 150 | 250 | 60.0% | 40.0% |
| MADTO | 90 | 190 | 47.4% | 52.6% |

## Plan

### 1. Create `calculate_creator_share` DB function

A single deterministic Postgres function to eliminate inconsistency:

```sql
CREATE FUNCTION calculate_creator_share(
  p_claimed_sol NUMERIC,
  p_creator_fee_bps INTEGER,
  p_trading_fee_bps INTEGER
) RETURNS TABLE(creator_sol NUMERIC, platform_sol NUMERIC)
```

Uses `FLOOR(sol * creator_ratio * 1e9) / 1e9` — platform absorbs rounding dust, system never overpays.

### 2. Create `creator_fee_ledger` table

Append-only audit trail recording every fee split at claim-time with bps snapshots:

- `fun_token_id`, `fee_claim_id`, `total_claimed_sol`, `creator_share_sol`, `platform_share_sol`
- `creator_fee_bps`, `trading_fee_bps` (frozen at claim time)
- `status` (pending → distributed), `distribution_signature`

RLS: service-role only. CHECK constraint: `creator_share_sol + platform_share_sol = total_claimed_sol`.

### 3. Update `fun-claim-fees`

After each successful pool claim, insert a `creator_fee_ledger` entry using the token's stored bps. This happens atomically at claim-time so there's never a gap.

### 4. Rewrite `fun-distribute` fee split logic

Remove ALL hardcoded share constants (`CREATOR_FEE_SHARE = 0.5`, `AGENT_*`, `API_*`, `PUNCH_*`). Replace with a single path:

```typescript
const creatorShare = token.creator_fee_bps / token.trading_fee_bps;
const platformShare = 1 - creatorShare;
recipientAmount = Math.floor(claimedSol * creatorShare * 1e9) / 1e9;
platformAmount = claimedSol - recipientAmount;
```

All token types (regular, phantom, agent, API, punch) use the same formula. The only variation is **who receives** the creator share (creator wallet, agent wallet, API fee wallet, etc.).

### 5. Update `claw-creator-claim`

Replace `CREATOR_SHARE = 0.3` with per-token lookup of `creator_fee_bps / trading_fee_bps`.

### 6. Update `claw-distribute`

Replace `CREATOR_FEE_SHARE = 0.3` / `AGENT_FEE_SHARE = 0.3` / `SYSTEM_FEE_SHARE = 0.4` with the same per-token bps formula.

### 7. Update `agent-find-by-twitter`

Replace `CREATOR_SHARE = 0.8` with per-token bps lookup.

### 8. Backfill ledger for existing claims

Insert historical `creator_fee_ledger` entries for the 4 active tokens using their stored bps, based on existing `fun_fee_claims` records.

### 9. Lower minimum distribution threshold

Reduce `MIN_DISTRIBUTION_SOL` from `0.05` to `0.005` so small earners (like Shroomzy at 9.1% creator share) actually receive payouts.

## Files Changed

| File | Change |
|---|---|
| New DB migration | `creator_fee_ledger` table + `calculate_creator_share` function |
| `supabase/functions/fun-claim-fees/index.ts` | Insert ledger entry after each claim |
| `supabase/functions/fun-distribute/index.ts` | Remove all hardcoded shares, use bps formula |
| `supabase/functions/claw-creator-claim/index.ts` | Replace `0.3` with bps lookup |
| `supabase/functions/claw-distribute/index.ts` | Replace hardcoded shares with bps lookup |
| `supabase/functions/agent-find-by-twitter/index.ts` | Replace `0.8` with bps lookup |
| Backfill migration | Historical ledger entries for existing claims |

