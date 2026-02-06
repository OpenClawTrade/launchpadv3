-- =====================================================
-- TUNA Project - Database Data Export Queries
-- =====================================================
-- This file contains queries to export all data from 110 tables
-- 
-- HOW TO USE:
-- 1. Run each query in a SQL editor
-- 2. Export results to CSV or JSON
-- 3. Store exports safely for restoration
-- =====================================================

-- =====================================================
-- CORE TOKEN TABLES
-- =====================================================

-- Fun Tokens (Main token registry)
SELECT * FROM public.fun_tokens ORDER BY created_at DESC;
-- Export as: fun_tokens.csv

-- Legacy Tokens table
SELECT * FROM public.tokens ORDER BY created_at DESC;
-- Export as: tokens.csv

-- Token Holdings (Who holds what)
SELECT * FROM public.token_holdings ORDER BY updated_at DESC;
-- Export as: token_holdings.csv

-- Token Price History
SELECT * FROM public.token_price_history ORDER BY timestamp DESC;
-- Export as: token_price_history.csv

-- Token Comments
SELECT * FROM public.token_comments ORDER BY created_at DESC;
-- Export as: token_comments.csv

-- Token Promotions
SELECT * FROM public.token_promotions ORDER BY created_at DESC;
-- Export as: token_promotions.csv

-- =====================================================
-- USER & PROFILE TABLES
-- =====================================================

-- Profiles (User profiles)
SELECT * FROM public.profiles ORDER BY created_at DESC;
-- Export as: profiles.csv

-- User Roles
SELECT * FROM public.user_roles;
-- Export as: user_roles.csv

-- User Bans
SELECT * FROM public.user_bans;
-- Export as: user_bans.csv

-- IP Bans
SELECT * FROM public.ip_bans;
-- Export as: ip_bans.csv

-- User IP Logs
SELECT * FROM public.user_ip_logs ORDER BY created_at DESC;
-- Export as: user_ip_logs.csv

-- User Blocks
SELECT * FROM public.user_blocks;
-- Export as: user_blocks.csv

-- User Mutes
SELECT * FROM public.user_mutes;
-- Export as: user_mutes.csv

-- Follows
SELECT * FROM public.follows;
-- Export as: follows.csv

-- =====================================================
-- AGENT TABLES
-- =====================================================

-- Agents (Main agent registry)
SELECT * FROM public.agents ORDER BY created_at DESC;
-- Export as: agents.csv

-- Agent Tokens (Links agents to tokens)
SELECT * FROM public.agent_tokens;
-- Export as: agent_tokens.csv

-- Agent Engagements
SELECT * FROM public.agent_engagements ORDER BY created_at DESC;
-- Export as: agent_engagements.csv

-- Agent Fee Distributions
SELECT * FROM public.agent_fee_distributions ORDER BY created_at DESC;
-- Export as: agent_fee_distributions.csv

-- Agent Post History
SELECT * FROM public.agent_post_history ORDER BY created_at DESC;
-- Export as: agent_post_history.csv

-- Agent Social Posts
SELECT * FROM public.agent_social_posts ORDER BY created_at DESC;
-- Export as: agent_social_posts.csv

-- Agent Verifications
SELECT * FROM public.agent_verifications ORDER BY created_at DESC;
-- Export as: agent_verifications.csv

-- =====================================================
-- TRADING AGENT TABLES
-- =====================================================

-- Trading Agents
SELECT * FROM public.trading_agents ORDER BY created_at DESC;
-- Export as: trading_agents.csv

-- Trading Agent Positions
SELECT * FROM public.trading_agent_positions ORDER BY opened_at DESC;
-- Export as: trading_agent_positions.csv

-- Trading Agent Trades
SELECT * FROM public.trading_agent_trades ORDER BY created_at DESC;
-- Export as: trading_agent_trades.csv

-- Trading Agent Strategy Reviews
SELECT * FROM public.trading_agent_strategy_reviews ORDER BY created_at DESC;
-- Export as: trading_agent_strategy_reviews.csv

-- Trading Agent Fee Deposits
SELECT * FROM public.trading_agent_fee_deposits ORDER BY created_at DESC;
-- Export as: trading_agent_fee_deposits.csv

-- =====================================================
-- SUBTUNA (COMMUNITY) TABLES
-- =====================================================

-- Subtuna (Communities)
SELECT * FROM public.subtuna ORDER BY created_at DESC;
-- Export as: subtuna.csv

-- Subtuna Posts
SELECT * FROM public.subtuna_posts ORDER BY created_at DESC;
-- Export as: subtuna_posts.csv

-- Subtuna Comments
SELECT * FROM public.subtuna_comments ORDER BY created_at DESC;
-- Export as: subtuna_comments.csv

-- Subtuna Votes
SELECT * FROM public.subtuna_votes;
-- Export as: subtuna_votes.csv

-- Subtuna Comment Votes
SELECT * FROM public.subtuna_comment_votes;
-- Export as: subtuna_comment_votes.csv

-- Subtuna Members
SELECT * FROM public.subtuna_members;
-- Export as: subtuna_members.csv

-- Subtuna Guest Votes
SELECT * FROM public.subtuna_guest_votes;
-- Export as: subtuna_guest_votes.csv

-- Subtuna Reports
SELECT * FROM public.subtuna_reports ORDER BY created_at DESC;
-- Export as: subtuna_reports.csv

-- =====================================================
-- FEE & DISTRIBUTION TABLES
-- =====================================================

-- Fun Fee Claims
SELECT * FROM public.fun_fee_claims ORDER BY claimed_at DESC;
-- Export as: fun_fee_claims.csv

-- Fun Distributions
SELECT * FROM public.fun_distributions ORDER BY created_at DESC;
-- Export as: fun_distributions.csv

-- Fun Buybacks
SELECT * FROM public.fun_buybacks ORDER BY created_at DESC;
-- Export as: fun_buybacks.csv

-- Fee Earners
SELECT * FROM public.fee_earners;
-- Export as: fee_earners.csv

-- Fee Claims (Legacy)
SELECT * FROM public.fee_claims ORDER BY created_at DESC;
-- Export as: fee_claims.csv

-- Fee Pool Claims
SELECT * FROM public.fee_pool_claims ORDER BY created_at DESC;
-- Export as: fee_pool_claims.csv

-- Bags Fee Claims
SELECT * FROM public.bags_fee_claims ORDER BY claimed_at DESC;
-- Export as: bags_fee_claims.csv

-- PumpFun Fee Claims
SELECT * FROM public.pumpfun_fee_claims ORDER BY claimed_at DESC;
-- Export as: pumpfun_fee_claims.csv

-- Treasury Fee Claims
SELECT * FROM public.treasury_fee_claims ORDER BY claimed_at DESC;
-- Export as: treasury_fee_claims.csv

-- Treasury Pool Cache
SELECT * FROM public.treasury_pool_cache;
-- Export as: treasury_pool_cache.csv

-- Holder Reward Pool
SELECT * FROM public.holder_reward_pool;
-- Export as: holder_reward_pool.csv

-- Holder Reward Payouts
SELECT * FROM public.holder_reward_payouts ORDER BY created_at DESC;
-- Export as: holder_reward_payouts.csv

-- Holder Reward Snapshots
SELECT * FROM public.holder_reward_snapshots ORDER BY created_at DESC;
-- Export as: holder_reward_snapshots.csv

-- =====================================================
-- API TABLES
-- =====================================================

-- API Accounts
SELECT * FROM public.api_accounts ORDER BY created_at DESC;
-- Export as: api_accounts.csv

-- API Launchpads
SELECT * FROM public.api_launchpads ORDER BY created_at DESC;
-- Export as: api_launchpads.csv

-- API Launchpad Tokens
SELECT * FROM public.api_launchpad_tokens;
-- Export as: api_launchpad_tokens.csv

-- API Fee Distributions
SELECT * FROM public.api_fee_distributions ORDER BY created_at DESC;
-- Export as: api_fee_distributions.csv

-- API Usage Logs
SELECT * FROM public.api_usage_logs ORDER BY created_at DESC;
-- Export as: api_usage_logs.csv

-- API Webhooks
SELECT * FROM public.api_webhooks;
-- Export as: api_webhooks.csv

-- =====================================================
-- TRANSACTION TABLES
-- =====================================================

-- Launchpad Transactions
SELECT * FROM public.launchpad_transactions ORDER BY created_at DESC;
-- Export as: launchpad_transactions.csv

-- Sniper Trades
SELECT * FROM public.sniper_trades ORDER BY created_at DESC;
-- Export as: sniper_trades.csv

-- Wallet Trades
SELECT * FROM public.wallet_trades ORDER BY created_at DESC;
-- Export as: wallet_trades.csv

-- Copy Trade Executions
SELECT * FROM public.copy_trade_executions ORDER BY created_at DESC;
-- Export as: copy_trade_executions.csv

-- DCA Orders
SELECT * FROM public.dca_orders ORDER BY created_at DESC;
-- Export as: dca_orders.csv

-- Limit Orders
SELECT * FROM public.limit_orders ORDER BY created_at DESC;
-- Export as: limit_orders.csv

-- =====================================================
-- TWITTER/X TABLES
-- =====================================================

-- Twitter Bot Replies
SELECT * FROM public.twitter_bot_replies ORDER BY created_at DESC;
-- Export as: twitter_bot_replies.csv

-- Twitter Style Library
SELECT * FROM public.twitter_style_library;
-- Export as: twitter_style_library.csv

-- X Bot Rate Limits
SELECT * FROM public.x_bot_rate_limits;
-- Export as: x_bot_rate_limits.csv

-- X Launch Events
SELECT * FROM public.x_launch_events ORDER BY created_at DESC;
-- Export as: x_launch_events.csv

-- X Pending Requests
SELECT * FROM public.x_pending_requests ORDER BY created_at DESC;
-- Export as: x_pending_requests.csv

-- Influencer List Config
SELECT * FROM public.influencer_list_config;
-- Export as: influencer_list_config.csv

-- Influencer Replies
SELECT * FROM public.influencer_replies ORDER BY created_at DESC;
-- Export as: influencer_replies.csv

-- Promo Mention Queue
SELECT * FROM public.promo_mention_queue ORDER BY created_at DESC;
-- Export as: promo_mention_queue.csv

-- Promo Mention Replies
SELECT * FROM public.promo_mention_replies ORDER BY created_at DESC;
-- Export as: promo_mention_replies.csv

-- =====================================================
-- SOCIAL TABLES
-- =====================================================

-- Posts (Legacy social)
SELECT * FROM public.posts ORDER BY created_at DESC;
-- Export as: posts.csv

-- Likes
SELECT * FROM public.likes;
-- Export as: likes.csv

-- Bookmarks
SELECT * FROM public.bookmarks;
-- Export as: bookmarks.csv

-- Notifications
SELECT * FROM public.notifications ORDER BY created_at DESC;
-- Export as: notifications.csv

-- Reports
SELECT * FROM public.reports ORDER BY created_at DESC;
-- Export as: reports.csv

-- Hashtags
SELECT * FROM public.hashtags;
-- Export as: hashtags.csv

-- Post Hashtags
SELECT * FROM public.post_hashtags;
-- Export as: post_hashtags.csv

-- Messages
SELECT * FROM public.messages ORDER BY created_at DESC;
-- Export as: messages.csv

-- Conversations
SELECT * FROM public.conversations ORDER BY updated_at DESC;
-- Export as: conversations.csv

-- =====================================================
-- COMMUNITY TABLES
-- =====================================================

-- Communities
SELECT * FROM public.communities ORDER BY created_at DESC;
-- Export as: communities.csv

-- Community Members
SELECT * FROM public.community_members;
-- Export as: community_members.csv

-- =====================================================
-- GOVERNANCE TABLES
-- =====================================================

-- Governance Conversations
SELECT * FROM public.governance_conversations ORDER BY created_at DESC;
-- Export as: governance_conversations.csv

-- Governance Messages
SELECT * FROM public.governance_messages ORDER BY created_at DESC;
-- Export as: governance_messages.csv

-- Governance Suggestions
SELECT * FROM public.governance_suggestions ORDER BY created_at DESC;
-- Export as: governance_suggestions.csv

-- =====================================================
-- TRENDING & ANALYTICS TABLES
-- =====================================================

-- Trending Narratives
SELECT * FROM public.trending_narratives ORDER BY created_at DESC;
-- Export as: trending_narratives.csv

-- Trending Tokens
SELECT * FROM public.trending_tokens ORDER BY created_at DESC;
-- Export as: trending_tokens.csv

-- Trending Topics
SELECT * FROM public.trending_topics ORDER BY created_at DESC;
-- Export as: trending_topics.csv

-- Narrative History
SELECT * FROM public.narrative_history ORDER BY created_at DESC;
-- Export as: narrative_history.csv

-- PumpFun Trending Tokens
SELECT * FROM public.pumpfun_trending_tokens ORDER BY created_at DESC;
-- Export as: pumpfun_trending_tokens.csv

-- =====================================================
-- INFRASTRUCTURE TABLES
-- =====================================================

-- Vanity Keypairs (Pre-generated wallets)
SELECT * FROM public.vanity_keypairs ORDER BY created_at DESC;
-- Export as: vanity_keypairs.csv
-- NOTE: Contains encrypted private keys - handle with care!

-- Deployer Wallets
SELECT * FROM public.deployer_wallets;
-- Export as: deployer_wallets.csv

-- Tracked Wallets
SELECT * FROM public.tracked_wallets;
-- Export as: tracked_wallets.csv

-- Pool State Cache
SELECT * FROM public.pool_state_cache;
-- Export as: pool_state_cache.csv

-- Visitor Sessions
SELECT * FROM public.visitor_sessions ORDER BY last_seen_at DESC;
-- Export as: visitor_sessions.csv

-- =====================================================
-- JOB & LOCK TABLES
-- =====================================================

-- Fun Token Jobs
SELECT * FROM public.fun_token_jobs ORDER BY created_at DESC;
-- Export as: fun_token_jobs.csv

-- Cron Locks
SELECT * FROM public.cron_locks;
-- Export as: cron_locks.csv

-- Creator Claim Locks
SELECT * FROM public.creator_claim_locks;
-- Export as: creator_claim_locks.csv

-- Launch Idempotency Locks
SELECT * FROM public.launch_idempotency_locks;
-- Export as: launch_idempotency_locks.csv

-- Launch Rate Limits
SELECT * FROM public.launch_rate_limits;
-- Export as: launch_rate_limits.csv

-- Pending Token Metadata
SELECT * FROM public.pending_token_metadata;
-- Export as: pending_token_metadata.csv

-- =====================================================
-- LOGGING & DEBUG TABLES
-- =====================================================

-- Debug Logs
SELECT * FROM public.debug_logs ORDER BY created_at DESC LIMIT 10000;
-- Export as: debug_logs.csv

-- AI Request Log
SELECT * FROM public.ai_request_log ORDER BY created_at DESC;
-- Export as: ai_request_log.csv

-- AI Usage Daily
SELECT * FROM public.ai_usage_daily ORDER BY date DESC;
-- Export as: ai_usage_daily.csv

-- Hourly Post Log
SELECT * FROM public.hourly_post_log ORDER BY created_at DESC;
-- Export as: hourly_post_log.csv

-- =====================================================
-- BASE CHAIN TABLES
-- =====================================================

-- Base Buybacks
SELECT * FROM public.base_buybacks ORDER BY created_at DESC;
-- Export as: base_buybacks.csv

-- Base Creator Claims
SELECT * FROM public.base_creator_claims ORDER BY claimed_at DESC;
-- Export as: base_creator_claims.csv

-- =====================================================
-- COLOSSEUM TABLES
-- =====================================================

-- Colosseum Activity
SELECT * FROM public.colosseum_activity ORDER BY created_at DESC;
-- Export as: colosseum_activity.csv

-- Colosseum Forum Posts
SELECT * FROM public.colosseum_forum_posts ORDER BY created_at DESC;
-- Export as: colosseum_forum_posts.csv

-- Colosseum Forum Comments
SELECT * FROM public.colosseum_forum_comments ORDER BY created_at DESC;
-- Export as: colosseum_forum_comments.csv

-- Colosseum Registrations
SELECT * FROM public.colosseum_registrations ORDER BY created_at DESC;
-- Export as: colosseum_registrations.csv

-- =====================================================
-- MISC TABLES
-- =====================================================

-- Countdown Timers
SELECT * FROM public.countdown_timers;
-- Export as: countdown_timers.csv

-- =====================================================
-- ROW COUNTS FOR ALL TABLES (Run this for inventory)
-- =====================================================

SELECT 
  schemaname,
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- =====================================================
-- COMPLETE DATA EXPORT SUMMARY
-- =====================================================
/*
Total Tables: 110

Categories:
- Core Token Tables: 6
- User & Profile Tables: 8
- Agent Tables: 7
- Trading Agent Tables: 5
- SubTuna Tables: 8
- Fee & Distribution Tables: 13
- API Tables: 6
- Transaction Tables: 6
- Twitter/X Tables: 9
- Social Tables: 9
- Community Tables: 2
- Governance Tables: 3
- Trending & Analytics Tables: 5
- Infrastructure Tables: 6
- Job & Lock Tables: 6
- Logging Tables: 4
- Base Chain Tables: 2
- Colosseum Tables: 4
- Misc Tables: 1

CRITICAL TABLES TO BACKUP FIRST:
1. fun_tokens - All launched tokens
2. agents - AI agent data
3. trading_agents - Trading agent data
4. profiles - User profiles
5. subtuna_posts - All community posts
6. vanity_keypairs - Pre-generated wallets (contains encrypted keys)
7. api_accounts - API integrators
8. fun_fee_claims - Fee claim history
9. fun_distributions - Payout history
*/
