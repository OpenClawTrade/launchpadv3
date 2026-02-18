
# Full Database Cleanup & Bot Shutdown Plan

This plan performs a complete data wipe as requested, stops all cron jobs and bots, and also fixes the injected malicious wallet address in the UI.

---

## What Will Be Done

### 1. Fix the Injected Malicious Code (LaunchCountdown.tsx)
The attacker injected `EpAAWyTHAcanJiHjX246jfB9L5xfLGXbNYzxwjmyTUNA` into the UI text. This will be reverted immediately to the original safe text: `"Token is almost ready to go Live"`.

---

### 2. Stop All Cron Jobs (23 active jobs)
Every scheduled job will be unscheduled via SQL:

- `agent-auto-engage-5min`
- `agent-daily-post`
- `agent-scan-twitter-2min`
- `agent-scan-twitter-every-minute`
- `calculate-trending-topics`
- `claw-agent-engage-every-10min`
- `colosseum-auto-engage-20min`
- `dune-sync-every-15-min`
- `dune-sync-optimized`
- `fun-claim-fees-every-minute`
- `fun-distribute-30min`
- `fun-holder-distribute-every-5-min`
- `fun-pool-cache-every-minute`
- `influencer-list-reply-30min`
- `promo-mention-reply-1min`
- `promo-mention-scan-2min`
- `pump-claim-fees-every-5-min`
- `trading-agent-execute-2min`
- `trading-agent-monitor-1min`
- `trending-sync-ui-display-30min`
- `vanity-cron-every-minute`
- `x-bot-reply-1min`
- `x-bot-scan-1min`

---

### 3. Disable All Bot Accounts
- Set `ai67x_fun` (the only account found) `is_active = false`
- Disable all rules in `x_bot_account_rules`

---

### 4. Full Data Wipe (in dependency order)

The following tables will be fully cleared using `TRUNCATE ... CASCADE` or `DELETE FROM` in the correct order to avoid foreign key errors:

**Bot & Social Tables:**
- `x_bot_account_queue`, `x_bot_account_replies`, `x_bot_account_logs`
- `twitter_bot_replies`
- `promo_mention_queue`, `promo_mention_replies`
- `influencer_replies`
- `hourly_post_log`
- `narrative_history`

**Vanity Keypairs:**
- `vanity_keypairs` — ALL 387 records deleted

**Tokens & History:**
- `token_promotions`
- `token_comments`
- `token_holdings`
- `token_price_history`
- `launchpad_transactions`
- `pending_token_metadata`
- `pool_state_cache`
- `treasury_pool_cache`
- `fun_token_jobs`
- `fun_tokens`
- `tokens`
- `sniper_trades`
- `pumpfun_trending_tokens`
- `trending_tokens`

**Agents & History:**
- `agent_engagements`
- `agent_social_posts`
- `agent_post_history` (49,459 records)
- `agent_verifications`
- `agent_fee_distributions`
- `agent_tokens`
- `agents`
- `trading_agent_fee_deposits`
- `trading_agent_trades`
- `trading_agent_positions`
- `trading_agent_strategy_reviews`
- `trading_agents`
- `deployer_wallets`
- `claw_agents`, `claw_agent_tokens`, `claw_agent_bids`, `claw_agent_fee_distributions`
- `claw_trading_agents`, `claw_trading_trades`, `claw_trading_positions`, `claw_trading_strategy_reviews`, `claw_trading_fee_deposits`
- `opentuna_agents`, `opentuna_agent_integrations`, `opentuna_api_keys`
- `opentuna_fin_executions`, `opentuna_fins`, `opentuna_fin_rack`
- `opentuna_deep_memory`, `opentuna_dna`, `opentuna_sonar_pings`
- `opentuna_current_flows`, `opentuna_school_tasks`, `opentuna_schools`

**Fee Claims & Financial History:**
- `fun_fee_claims` (1,432 records — 46.49 SOL historical)
- `treasury_fee_claims`
- `pumpfun_fee_claims`
- `fee_claims`
- `bags_fee_claims`
- `fee_pool_claims`
- `fee_earners`
- `fun_distributions`
- `fun_buybacks`
- `holder_reward_payouts`
- `holder_reward_pool`
- `holder_reward_snapshots`
- `creator_claim_locks`
- `claw_fee_claims`, `claw_distributions`
- `claw_creator_claim_locks`, `claw_deployer_wallets`
- `partner_fee_distributions`
- `api_fee_distributions`
- `base_buybacks`, `base_creator_claims`
- `treasury_fee_claims`
- `tunnel_distribution_runs`
- `tuna_migration_ledger`, `tuna_migration_snapshot`, `tuna_migration_transactions`

**Debug & Logs:**
- `debug_logs`
- `ai_request_log`
- `ai_usage_daily`
- `api_usage_logs`
- `cron_locks`
- `launch_idempotency_locks`
- `launch_rate_limits`

---

### What Will NOT Be Touched
- `profiles` and user accounts
- `subtuna` communities, posts, comments, votes
- `posts`, `follows`, `likes`, `notifications`
- `api_accounts` and `api_launchpads`
- `user_bans`, `ip_bans` (security data)
- `hashtags`

---

## Implementation Steps

1. Run SQL migration to unschedule all 23 cron jobs
2. Run SQL migration to disable bot accounts
3. Run SQL migration to wipe all data tables in dependency order
4. Fix the injected malicious wallet address in `LaunchCountdown.tsx`

All done in a single approve action.
