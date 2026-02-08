
# Multi-Account X Reply Bot Admin System

## Overview
Create a comprehensive admin system to manage multiple X (Twitter) reply bot accounts, allowing you to configure different proxies, credentials, and targeting rules per account, with consistent cron scheduling across all accounts.

## Current System Analysis
The existing BuildTuna reply bot has these settings:
- **Minimum followers**: 5,000 (verified accounts only)
- **Verification requirement**: Blue or Gold checkmark required
- **Monitored mentions**: @moltbook, @openclaw, @buildtuna, @tunalaunch
- **Cashtags**: Currently NOT tracked (only platform mentions)
- **Author cooldown**: 6 hours between replies to same author
- **Max replies per thread**: 3 (1 initial + 2 follow-ups)

---

## Implementation Plan

### 1. Database Schema
Create new tables to store multi-account configurations:

```sql
-- X Bot accounts configuration
CREATE TABLE x_bot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  password_encrypted TEXT,
  totp_secret_encrypted TEXT,
  full_cookie_encrypted TEXT,
  auth_token_encrypted TEXT,
  ct0_token_encrypted TEXT,
  proxy_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account targeting rules
CREATE TABLE x_bot_account_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES x_bot_accounts(id) ON DELETE CASCADE,
  monitored_mentions TEXT[] DEFAULT '{}',
  tracked_cashtags TEXT[] DEFAULT '{}',
  min_follower_count INTEGER DEFAULT 5000,
  require_blue_verified BOOLEAN DEFAULT true,
  require_gold_verified BOOLEAN DEFAULT false,
  author_cooldown_hours INTEGER DEFAULT 6,
  max_replies_per_thread INTEGER DEFAULT 3,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account reply logs
CREATE TABLE x_bot_account_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES x_bot_accounts(id),
  tweet_id TEXT NOT NULL,
  tweet_author TEXT,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  reply_id TEXT,
  reply_text TEXT,
  reply_type TEXT DEFAULT 'initial',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account tweet queue
CREATE TABLE x_bot_account_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES x_bot_accounts(id),
  tweet_id TEXT NOT NULL,
  tweet_author TEXT,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  follower_count INTEGER,
  is_verified BOOLEAN,
  match_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(account_id, tweet_id)
);
```

### 2. New Edge Functions

**`x-bot-scan`** - Unified scanner for all accounts:
- Loops through active accounts
- Applies per-account targeting rules
- Searches for configured mentions AND cashtags
- Queues tweets per-account

**`x-bot-reply`** - Unified replier for all accounts:
- Processes queue per-account
- Uses account-specific cookies/proxy
- Respects per-account cooldowns
- Logs replies to account-specific table

### 3. Admin Page (`/admin/x-bots`)

**Features:**
- Password-protected (same as treasury: `tuna2024treasury`)
- Account management (add/edit/delete)
- Per-account configuration:
  - Credentials (username, email, password, TOTP)
  - Cookie session (full cookie OR auth_token + ct0)
  - Proxy URL
  - Targeting rules
- Live status dashboard
- Reply history per account
- Manual run buttons

**UI Sections:**

1. **Accounts List**
   - Name, username, status, last active
   - Quick enable/disable toggle
   - Edit/Delete actions

2. **Account Configuration Modal**
   - Credentials tab (encrypted storage)
   - Proxy settings
   - Targeting rules:
     - Mentions to follow (multi-select)
     - Cashtags to track (e.g., $BTC, $SOL, $TUNA)
     - Min followers (slider: 1K-50K)
     - Verification requirements (checkboxes)
     - Cooldown settings

3. **Activity Dashboard**
   - Per-account stats (replies today, success rate)
   - Recent replies table
   - Error log viewer

4. **Global Controls**
   - Master kill switch
   - Run scan now (all accounts)
   - Run reply now (all accounts)

### 4. Cron Configuration
Maintain existing schedule consistency:
- **Scan**: Every 2 minutes
- **Reply**: Every 1 minute
- **Lock mechanism**: Per-account locks to prevent overlap

### 5. Security Considerations
- Credentials encrypted with existing WALLET_ENCRYPTION_KEY
- Proxy per account for IP separation
- Rate limiting per account
- Audit logging for all actions

---

## Technical Architecture

```text
+------------------+     +-------------------+
|  Admin UI        |     |  Cron Scheduler   |
|  /admin/x-bots   |     |  (pg_cron)        |
+--------+---------+     +--------+----------+
         |                        |
         v                        v
+------------------+     +-------------------+
| x_bot_accounts   |<--->|  x-bot-scan       |
| x_bot_rules      |     |  Edge Function    |
+------------------+     +-------------------+
                                  |
                                  v
                         +-------------------+
                         | x_bot_account_    |
                         | queue             |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         |  x-bot-reply      |
                         |  Edge Function    |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | x_bot_account_    |
                         | replies           |
                         +-------------------+
```

---

## Files to Create/Modify

### New Files:
1. `src/pages/XBotAdminPage.tsx` - Main admin page
2. `src/components/admin/XBotAccountsPanel.tsx` - Account list
3. `src/components/admin/XBotAccountForm.tsx` - Add/edit form
4. `src/components/admin/XBotRulesForm.tsx` - Targeting rules
5. `src/components/admin/XBotActivityPanel.tsx` - Activity dashboard
6. `src/hooks/useXBotAccounts.ts` - Data fetching hook
7. `supabase/functions/x-bot-scan/index.ts` - Multi-account scanner
8. `supabase/functions/x-bot-reply/index.ts` - Multi-account replier

### Modifications:
1. `src/App.tsx` - Add route for `/admin/x-bots`
2. Database migration for new tables

---

## Summary of Current Bot Settings (for reference)

| Setting | Current Value |
|---------|---------------|
| Minimum Followers | 5,000 |
| Verification | Blue OR Gold required |
| Monitored Mentions | @moltbook, @openclaw, @buildtuna, @tunalaunch |
| Tracked Cashtags | None (not implemented) |
| Author Cooldown | 6 hours |
| Max Replies/Thread | 3 |
| Scan Frequency | Every 2 minutes |
| Reply Frequency | Every 1 minute |
