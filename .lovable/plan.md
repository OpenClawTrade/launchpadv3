
## Wipe All Legacy TUNA Data from the Platform

### What's Currently Showing in the UI

The site is displaying old TUNA-era data from these tables (none of it is Claw Mode data — claw tables are all empty):

| Table | Row Count |
|---|---|
| fun_tokens | 461 |
| agents | 196 |
| agent_tokens | 183 |
| trading_agents | 14 |
| trading_agent_trades | 46 |
| trading_agent_positions | 28 |
| trading_agent_fee_deposits | 226 |
| agent_fee_distributions | 304 |
| agent_social_posts | 534 |
| agent_post_history | 49,685 |
| fun_fee_claims | 1,464 |
| fee_earners | 288 |
| fun_distributions | 85 |
| token_price_history | 1,081 |
| tokens | 393 |
| sniper_trades | 133 |
| pending_token_metadata | 165 |
| token_promotions | 79,763 |
| twitter_bot_replies | 120 |
| launch_rate_limits | 196 |
| launch_idempotency_locks | 71 |
| pumpfun_trending_tokens | 48 |
| trending_tokens | 30 |
| pool_state_cache | 2 |
| fun_token_jobs | 2 |

Also clearing high-volume logs and queue tables that are TUNA artifacts:
- `ai_request_log` (74,072 rows)
- `narrative_history` (56,874 rows)
- `x_bot_account_logs` (47,263 rows)
- `x_follower_scans` (35,044 rows)
- `promo_mention_replies` (2,278 rows)
- `x_bot_account_replies` (2,259 rows)
- `influencer_replies` (82 rows)
- `promo_mention_queue` (7 rows)
- `x_bot_account_queue` (29 rows)
- `colosseum_activity` (935 rows)
- `colosseum_engagement_log` (588 rows)
- `hourly_post_log` (11 rows)

### What Will NOT Be Wiped (Preserved)

- `claw_*` tables — all empty, ready for fresh Claw Mode data
- `profiles` — user accounts remain intact
- `user_roles` / `user_bans` — moderation data preserved
- `subtuna_posts` / `subtuna_comments` — forum/community posts preserved (these belong to users, not TUNA system)
- `tuna_migration_ledger` / `tuna_migration_snapshot` — migration records preserved (needed for the /migrate page)
- `whale_addresses` — useful data, preserve
- `visitor_sessions` — ephemeral, will auto-clear

### Technical Approach

Run TRUNCATE CASCADE on the legacy TUNA tables in dependency order to handle foreign keys cleanly. Use TRUNCATE rather than DELETE for speed (no row-by-row logging). TRUNCATE CASCADE handles child tables automatically.

### Execution Order (handles FK dependencies)

```text
1. Clear activity/log tables first (no dependents)
2. Clear fee/transaction tables
3. Clear token-related tables (agent_tokens, fee_earners, etc.)
4. Clear agent tables
5. Clear fun_tokens (root token table)
6. Clear tokens (bonding curve table)
```

### Single SQL block

```sql
TRUNCATE TABLE
  -- Log & queue tables
  ai_request_log,
  narrative_history,
  x_bot_account_logs,
  x_follower_scans,
  promo_mention_replies,
  x_bot_account_replies,
  influencer_replies,
  promo_mention_queue,
  x_bot_account_queue,
  colosseum_activity,
  colosseum_engagement_log,
  hourly_post_log,
  -- Token activity
  token_price_history,
  token_promotions,
  twitter_bot_replies,
  launch_rate_limits,
  launch_idempotency_locks,
  pumpfun_trending_tokens,
  trending_tokens,
  trending_narratives,
  pool_state_cache,
  -- Fees & distributions
  fun_fee_claims,
  fun_distributions,
  agent_fee_distributions,
  trading_agent_fee_deposits,
  partner_fee_distributions,
  fee_earners,
  holder_reward_payouts,
  holder_reward_snapshots,
  -- Agent activity
  agent_social_posts,
  agent_post_history,
  trading_agent_trades,
  trading_agent_positions,
  trading_agent_strategy_reviews,
  -- Linking tables
  agent_tokens,
  sniper_trades,
  pending_token_metadata,
  fun_token_jobs,
  -- Agents
  trading_agents,
  agents,
  -- Root token tables
  fun_tokens,
  tokens
CASCADE;
```

### Result After Wipe

- Token pages show 0 tokens
- Agents hub shows 0 agents
- Trading agents hub shows 0 trading agents
- Stats counters reset to 0
- All claw tables remain empty and ready for real Claw Mode launches
- Forum, user profiles, and migration data untouched
