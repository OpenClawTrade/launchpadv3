
# Plan: Clean Up Old Tokens from Database

## What stays
4 tokens in `fun_tokens` launched today (March 14):
- **PlanetEarthX** (PEX)
- **Shroomzy** (SHROO)  
- **doggo** (DGG)
- **Madtopus** (MADTO)

## What gets deleted

### Token tables
- **fun_tokens**: 924 old rows (pre-March 14)
- **tokens**: All 780 rows (entirely old project)

### Related data tables (clear completely since all reference old tokens)
- `launchpad_transactions` (42 rows)
- `token_holdings` (14 rows)
- `token_price_history` (310 rows)
- `fee_earners` (779 rows)
- `sniper_trades` (750 rows)
- `fun_fee_claims` (594 rows)
- `alpha_trades` (100 rows)
- `fun_token_jobs` (all rows)
- `fun_buybacks`, `fun_distributions`
- `agent_tokens`, `claw_agent_tokens`
- `token_promotions`, `punch_votes`
- `bags_fee_claims`, `pumpfun_fee_claims`
- `holder_reward_*` tables
- `dca_orders`, `limit_orders`
- `treasury_fee_claims`, `treasury_pool_cache`

### Approach
Use the data insert tool to run DELETE statements in batches:
1. Delete all related data from child tables first (no FK constraints found, but clean order is safer)
2. Delete old `fun_tokens` where `created_at < '2026-03-14'`
3. Delete all rows from `tokens` table
4. Verify only 4 tokens remain in `fun_tokens`

No code changes needed — this is purely a database cleanup operation.
