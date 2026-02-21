

# Fix Agents Page Stats — Accurate Data

## The Problem

The stats bar on the Agents page (`/agents?tab=tuna`) shows inaccurate/misleading data:

1. **"Fees Claimed" shows $3.36M** — This is actually fake "volume" data calculated as `market_cap * 10` in the database function, not real fees claimed at all
2. **"Agent Fees Earned" shows $393** — This is only counting 80% of the 5.7 SOL actually claimed from fee pools, which is technically correct but misleadingly low
3. **"Tokens Launched" shows 129 instead of 132** — Stale 5-minute cache on the edge function
4. **Market Cap seems roughly correct** at ~$336K (3,987 SOL at ~$86)

## Root Cause

The `get_agent_token_stats` RPC function has a fake volume calculation:
```sql
'totalVolume', SUM(market_cap_sol) * 10  -- completely fabricated
```

And the UI labels the volume stat as "Fees Claimed", making it doubly wrong.

## Plan

### Step 1: Update the `get_agent_token_stats` RPC function

Replace the fake volume metric with real fee data from `fun_fee_claims`:

- **totalMarketCap**: Keep as-is (SUM of market_cap_sol from fun_tokens)
- **totalAgentFeesEarned**: Change to total `total_fees_earned` from fun_tokens (full amount, not 80%) — this represents all fees generated
- **totalTokensLaunched**: Keep as-is (COUNT of fun_tokens)
- **totalVolume**: Replace fake `*10` calculation with actual `SUM(claimed_sol)` from `fun_fee_claims` — real on-chain claimed fees
- **totalAgents**: Keep as-is
- **totalAgentPosts**: Keep as-is
- **totalAgentPayouts**: Keep as-is

### Step 2: Fix the UI label in ClawBookPage.tsx

Change the 4th stat from showing `totalVolume` labeled "Fees Claimed" to showing actual claimed fees properly. The 4 stats will be:

1. **Total Market Cap** — totalMarketCap (correct)
2. **Agent Fees Earned** — totalAgentFeesEarned (all fees, not just 80%)
3. **Tokens Launched** — totalTokensLaunched (correct)
4. **Total Volume** — totalVolume (real claimed SOL, not fake multiplier)

### Step 3: Update AgentStatsBar.tsx consistency

Ensure the 5-stat bar on the main Agents page also uses the corrected data.

### Step 4: Redeploy the edge function

Deploy the updated `agent-stats` function so the cache refreshes with accurate data.

## Technical Details

**Database migration** — Update `get_agent_token_stats` RPC:
```sql
CREATE OR REPLACE FUNCTION get_agent_token_stats()
RETURNS json
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT json_build_object(
    'totalMarketCap', COALESCE((SELECT SUM(market_cap_sol) FROM public.fun_tokens), 0),
    'totalVolume', COALESCE((SELECT SUM(claimed_sol) FROM public.fun_fee_claims), 0),
    'totalTokensLaunched', COALESCE((SELECT COUNT(*) FROM public.fun_tokens), 0),
    'totalAgents', COALESCE((SELECT COUNT(*) FROM public.agents WHERE status = 'active'), 0),
    'totalAgentPosts', COALESCE((SELECT COUNT(*) FROM public.subtuna_posts WHERE is_agent_post = true), 0),
    'totalAgentFeesEarned', COALESCE((SELECT SUM(total_fees_earned) FROM public.fun_tokens), 0),
    'totalAgentPayouts', COALESCE((SELECT SUM(amount_sol) FROM public.agent_fee_distributions), 0)
  );
$$;
```

**Files to modify:**
- `src/pages/ClawBookPage.tsx` — Fix "Fees Claimed" label to "Total Volume" or use the correct data field
- `supabase/functions/agent-stats/index.ts` — No code change needed (it already calls the RPC)

After this fix, the stats will show real on-chain data instead of fabricated multipliers.
