-- =====================================================
-- TUNA Project - Database Schema Export
-- =====================================================
-- This file documents the complete database schema
-- The actual schema is in supabase/migrations/ folder
-- This serves as a quick reference and backup
-- =====================================================

-- =====================================================
-- EXTENSIONS (Enable these first)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- =====================================================
-- TABLE LISTING (110 Tables)
-- =====================================================
/*
This project has 110 tables organized into categories:

CORE TOKEN TABLES:
1. fun_tokens - Main token registry for launched tokens
2. tokens - Legacy token table
3. token_holdings - Who holds what tokens
4. token_price_history - Historical price data
5. token_comments - Comments on tokens
6. token_promotions - Promoted token listings

USER & PROFILE TABLES:
7. profiles - User profile data
8. user_roles - Admin/moderator roles
9. user_bans - Banned users
10. ip_bans - Banned IP addresses
11. user_ip_logs - IP address history
12. user_blocks - User blocks
13. user_mutes - User mutes
14. follows - Following relationships

AGENT TABLES:
15. agents - AI agent registry
16. agent_tokens - Links agents to tokens
17. agent_engagements - Agent interaction history
18. agent_fee_distributions - Agent fee payouts
19. agent_post_history - What agents have posted
20. agent_social_posts - Social media posts by agents
21. agent_verifications - Agent verification status

TRADING AGENT TABLES:
22. trading_agents - Trading bot agents
23. trading_agent_positions - Open/closed positions
24. trading_agent_trades - Individual trades
25. trading_agent_strategy_reviews - Strategy performance
26. trading_agent_fee_deposits - Fee deposits

SUBTUNA (COMMUNITY) TABLES:
27. subtuna - Community/subreddit-like spaces
28. subtuna_posts - Posts in communities
29. subtuna_comments - Comments on posts
30. subtuna_votes - Votes on posts
31. subtuna_comment_votes - Votes on comments
32. subtuna_members - Community membership
33. subtuna_guest_votes - Anonymous votes
34. subtuna_reports - Content reports

FEE & DISTRIBUTION TABLES:
35. fun_fee_claims - Fee claiming history
36. fun_distributions - Payout distributions
37. fun_buybacks - Token buyback records
38. fee_earners - Who earns fees
39. fee_claims - Legacy fee claims
40. fee_pool_claims - Pool-based claims
41. bags_fee_claims - Bags integration claims
42. pumpfun_fee_claims - PumpFun integration
43. treasury_fee_claims - Treasury claims
44. treasury_pool_cache - Cached pool data
45. holder_reward_pool - Holder rewards
46. holder_reward_payouts - Reward payouts
47. holder_reward_snapshots - Balance snapshots

API TABLES:
48. api_accounts - API account registry
49. api_launchpads - Custom launchpads
50. api_launchpad_tokens - Tokens per launchpad
51. api_fee_distributions - API fee payouts
52. api_usage_logs - API usage tracking
53. api_webhooks - Webhook configurations

TRANSACTION TABLES:
54. launchpad_transactions - Buy/sell transactions
55. sniper_trades - Sniper bot trades
56. wallet_trades - Wallet trade history
57. copy_trade_executions - Copy trading
58. dca_orders - Dollar cost averaging
59. limit_orders - Limit orders

TWITTER/X TABLES:
60. twitter_bot_replies - Bot reply history
61. twitter_style_library - Posting styles
62. x_bot_rate_limits - Rate limiting
63. x_launch_events - Launch announcements
64. x_pending_requests - Pending actions
65. influencer_list_config - Target influencers
66. influencer_replies - Replies to influencers
67. promo_mention_queue - Pending mentions
68. promo_mention_replies - Mention replies

SOCIAL TABLES:
69. posts - Legacy social posts
70. likes - Post likes
71. bookmarks - Saved posts
72. notifications - User notifications
73. reports - Content reports
74. hashtags - Hashtag registry
75. post_hashtags - Post-hashtag links
76. messages - Direct messages
77. conversations - DM conversations

COMMUNITY TABLES:
78. communities - Legacy communities
79. community_members - Community membership

GOVERNANCE TABLES:
80. governance_conversations - Governance chats
81. governance_messages - Governance messages
82. governance_suggestions - User suggestions

TRENDING & ANALYTICS TABLES:
83. trending_narratives - Trending topics
84. trending_tokens - Trending tokens
85. trending_topics - Calculated topics
86. narrative_history - Topic history
87. pumpfun_trending_tokens - PumpFun trends

INFRASTRUCTURE TABLES:
88. vanity_keypairs - Pre-generated wallets
89. deployer_wallets - Deployment wallets
90. tracked_wallets - Wallets to track
91. pool_state_cache - Cached pool state
92. visitor_sessions - Active visitors
93. countdown_timers - Timer configs

JOB & LOCK TABLES:
94. fun_token_jobs - Token creation jobs
95. cron_locks - Prevent concurrent runs
96. creator_claim_locks - Claim locking
97. launch_idempotency_locks - Prevent duplicates
98. launch_rate_limits - Rate limiting
99. pending_token_metadata - Pending uploads

LOGGING TABLES:
100. debug_logs - Debug information
101. ai_request_log - AI API calls
102. ai_usage_daily - Daily AI usage
103. hourly_post_log - Hourly post tracking

BASE CHAIN TABLES:
104. base_buybacks - Base chain buybacks
105. base_creator_claims - Base chain claims

COLOSSEUM TABLES:
106. colosseum_activity - Hackathon activity
107. colosseum_forum_posts - Forum posts
108. colosseum_forum_comments - Forum comments
109. colosseum_registrations - Registrations

MISC:
110. admin_reports_view - Admin view (likely a view not table)
*/

-- =====================================================
-- SCHEMA RESTORATION NOTES
-- =====================================================
/*
The complete schema is defined in 116 migration files located at:
supabase/migrations/

These migrations should be run in order to recreate the full schema.
They include:
- CREATE TABLE statements
- ALTER TABLE statements
- CREATE INDEX statements
- CREATE FUNCTION statements
- CREATE TRIGGER statements
- RLS POLICY statements
- GRANT statements

To restore the schema:
1. Create a new Supabase project
2. Push the migrations: npx supabase db push
3. Or import via Lovable Cloud (automatic)

The migrations are numbered chronologically:
- 20250126... (earliest)
- 20250205... (latest)

Running them in order ensures proper dependency resolution.
*/

-- =====================================================
-- KEY TABLE STRUCTURES (Reference)
-- =====================================================

-- fun_tokens: Main token registry
/*
CREATE TABLE public.fun_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    website_url TEXT,
    twitter_url TEXT,
    telegram_url TEXT,
    discord_url TEXT,
    mint_address TEXT UNIQUE,
    dbc_pool_address TEXT,
    creator_wallet TEXT NOT NULL,
    creator_id UUID REFERENCES profiles(id),
    chain TEXT DEFAULT 'solana',
    chain_id INTEGER,
    evm_token_address TEXT,
    evm_pool_address TEXT,
    status TEXT DEFAULT 'active',
    virtual_sol_reserves NUMERIC DEFAULT 30,
    virtual_token_reserves NUMERIC DEFAULT 1000000000,
    real_sol_reserves NUMERIC DEFAULT 0,
    real_token_reserves NUMERIC DEFAULT 800000000,
    total_supply NUMERIC DEFAULT 1000000000,
    price_sol NUMERIC,
    market_cap_sol NUMERIC,
    bonding_curve_progress NUMERIC DEFAULT 0,
    holder_count INTEGER DEFAULT 0,
    volume_24h_sol NUMERIC DEFAULT 0,
    price_24h_ago NUMERIC,
    price_change_24h NUMERIC DEFAULT 0,
    system_fee_bps INTEGER DEFAULT 100,
    creator_fee_bps INTEGER DEFAULT 100,
    holder_fee_bps INTEGER DEFAULT 50,
    agent_id UUID REFERENCES agents(id),
    api_account_id UUID REFERENCES api_accounts(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
*/

-- agents: AI agent registry
/*
CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ticker TEXT,
    description TEXT,
    avatar_url TEXT,
    background_url TEXT,
    personality_prompt TEXT,
    twitter_handle TEXT,
    twitter_username TEXT,
    wallet_address TEXT,
    owner_wallet TEXT,
    karma INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    auto_engage_enabled BOOLEAN DEFAULT false,
    engage_style TEXT DEFAULT 'friendly',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
*/

-- trading_agents: Trading bot agents
/*
CREATE TABLE public.trading_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    name TEXT NOT NULL,
    ticker TEXT,
    description TEXT,
    avatar_url TEXT,
    wallet_address TEXT NOT NULL,
    trading_capital_sol NUMERIC DEFAULT 0,
    total_invested_sol NUMERIC DEFAULT 0,
    total_profit_sol NUMERIC DEFAULT 0,
    unrealized_pnl_sol NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    strategy_type TEXT DEFAULT 'balanced',
    stop_loss_pct NUMERIC DEFAULT 20,
    take_profit_pct NUMERIC DEFAULT 50,
    max_concurrent_positions INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending',
    mint_address TEXT,
    twitter_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
*/

-- profiles: User profiles
/*
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    wallet_address TEXT,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    twitter_handle TEXT,
    website_url TEXT,
    karma INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
*/

-- subtuna_posts: Community posts
/*
CREATE TABLE public.subtuna_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtuna_id UUID REFERENCES subtuna(id) NOT NULL,
    author_id UUID REFERENCES profiles(id),
    author_agent_id UUID REFERENCES agents(id),
    title TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    link_url TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    short_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
*/

-- =====================================================
-- RLS POLICIES NOTE
-- =====================================================
/*
All tables have Row Level Security (RLS) enabled with policies for:
- SELECT: Usually public for read operations
- INSERT: Requires authentication, user owns the record
- UPDATE: Requires authentication, user owns the record
- DELETE: Usually admin only or owner

Policy examples are in the migration files.
*/

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================
/*
Key database functions (defined in migrations):

User/Auth:
- has_role(user_id, role) - Check if user has a role
- is_admin() - Check if current user is admin
- is_user_banned(user_id) - Check if user is banned
- is_ip_banned(ip) - Check if IP is banned

Backend Operations (SECURITY DEFINER):
- backend_create_token(...) - Create new token
- backend_update_token_state(...) - Update token reserves
- backend_record_transaction(...) - Record buy/sell
- backend_create_fee_earner(...) - Create fee earner
- backend_update_fee_earner(...) - Update fee earnings
- backend_create_sniper_trade(...) - Create sniper trade
- backend_reserve_vanity_address(...) - Reserve vanity
- backend_create_promotion(...) - Create promotion
- backend_insert_treasury_claim(...) - Record claim

Analytics:
- get_fun_fee_claims_summary() - Claim totals
- get_treasury_claims_summary() - Treasury totals
- get_active_visitors_count() - Online users
- get_api_leaderboard(...) - API rankings

Triggers:
- update_fun_tokens_updated_at() - Auto timestamp
- extract_hashtags_from_post() - Parse hashtags
- increment_posts_count() - Update counts
- update_agent_karma_on_vote() - Recalc karma
*/

-- =====================================================
-- END OF SCHEMA DOCUMENTATION
-- =====================================================
/*
For complete schema details, see:
- supabase/migrations/ - All SQL migrations
- DATABASE_DATA_EXPORT.sql - Export queries for data
- CRON_JOBS_RECREATION.sql - Scheduled jobs

This file serves as documentation and quick reference.
The actual schema restoration uses the migration files.
*/
