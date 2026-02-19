
## Full Platform Reset — Data Wipe

### What will be deleted (in dependency order)

This is a permanent, irreversible wipe of all platform data. Auth accounts (user logins) are preserved — only content/platform data is deleted.

**Order of deletion to avoid foreign key errors:**

**Round 1 — Leaf tables (no dependencies)**
- `subtuna_votes`, `subtuna_guest_votes`, `subtuna_comment_votes` — all vote records
- `subtuna_reports` — community reports
- `post_hashtags`, `hashtags` — hashtag index
- `notifications` — user notifications
- `bookmarks`, `likes`, `follows` — social graph
- `reports` — content reports
- `token_comments` — token page comments
- `token_price_history` — price candle history
- `debug_logs` — debug log entries
- `agent_engagements` — agent engagement records
- `agent_verifications` — agent verification data
- `ai_request_log`, `ai_usage_daily` — AI usage logs
- `narrative_history`, `trending_narratives`, `trending_topics`, `trending_tokens` — trending data
- `pool_state_cache`, `treasury_pool_cache` — cache tables
- `pumpfun_trending_tokens` — trending cache
- `hourly_post_log` — post rate log
- `launch_idempotency_locks`, `launch_rate_limits`, `cron_locks` — operational locks

**Round 2 — Mid-level (depend on tokens/agents)**
- `subtuna_comments` — community comments
- `subtuna_posts` — community posts (38K)
- `subtuna_members` — community memberships
- `fee_earners` — fee earner records (288)
- `fee_claims`, `fun_fee_claims`, `treasury_fee_claims`, `bags_fee_claims`, `pumpfun_fee_claims` — fee claim history
- `agent_fee_distributions`, `api_fee_distributions`, `partner_fee_distributions`, `holder_reward_payouts` — fee distributions
- `agent_social_posts` — agent post history (534)
- `agent_post_history` — agent post log
- `agent_tokens` — agent→token links (183)
- `trading_agent_trades`, `trading_agent_positions`, `trading_agent_strategy_reviews`, `trading_agent_fee_deposits` — trading agent data
- `fun_buybacks`, `fun_distributions`, `fun_token_jobs` — token operational data
- `token_promotions` — token promotion records
- `sniper_trades` — sniper trade records

**Round 3 — Core entities**
- `trading_agents` — 14 trading agents
- `agents` — 196 agents
- `fun_tokens` — 461 fun tokens
- `tokens` — 393 launchpad tokens
- `subtuna` / `communities` — community definitions
- `profiles` — 366 user profiles (auth accounts preserved)

**Round 4 — Claw Mode data**
- `claw_votes`, `claw_comments`, `claw_posts` — claw community data
- `claw_agent_tokens`, `claw_agent_fee_distributions`, `claw_agents`, `claw_tokens` — claw agent/token data

### Technical approach

This will be executed as a series of SQL `DELETE FROM` statements run via the Supabase insert/data tool in the correct order. No migrations needed — this is pure data deletion, not schema changes.

### What is NOT deleted
- Auth user accounts (login credentials)  
- Platform configuration tables (deployer wallets, vanity keypairs, API accounts)
- OpenTuna agent configuration
- Sidebar/navigation code

### After the wipe
- Agent count: 0
- Token count: 0
- Community posts: 0
- All stats bars will show $0 / 0

The reset will be executed in one go across ~40 table truncations.
