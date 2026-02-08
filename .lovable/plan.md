
# Plan: Add Process Console/Activity Log for X-Bot Accounts

## Overview
Create a detailed activity log system that records all step-by-step operations for each X-Bot account, providing visibility into login status, scanning activity, tweet discovery, and reply outcomes.

## What You'll Get
- A new "Console" tab in the Activity Panel showing real-time logs
- Timestamped entries for every operation (login, scan, match, reply)
- Success/error status with detailed messages
- Filter by log level (info, warn, error)
- Per-account log viewing

---

## Technical Implementation

### 1. Create New Database Table
A new `x_bot_account_logs` table to store all process events:

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| account_id | uuid | Links to x_bot_accounts |
| log_type | text | 'login', 'scan', 'match', 'reply', 'error' |
| level | text | 'info', 'warn', 'error' |
| message | text | Human-readable description |
| details | jsonb | Additional context data |
| created_at | timestamp | When it happened |

### 2. Update Edge Functions
Modify `x-bot-scan` and `x-bot-reply` to insert log entries:

**Scan function will log:**
- "Starting scan for account @username"
- "Found X tweets matching rules"
- "Tweet by @author queued (match: cashtag:$TUNA)"
- "Skipped: author below follower threshold"

**Reply function will log:**
- "Processing queued tweet by @author"
- "Generating reply..."
- "Reply posted successfully (ID: xxx)"
- "Reply failed: rate limited"

### 3. Add Console Tab to UI
New tab in `XBotActivityPanel.tsx`:

```text
┌─────────────────────────────────────────────┐
│ [Recent Replies] [Queue] [Console]          │
├─────────────────────────────────────────────┤
│ Filter: [All ▼] [info] [warn] [error]       │
├─────────────────────────────────────────────┤
│ 14:32:15 [INFO] Starting scan for @tunab0t  │
│ 14:32:17 [INFO] Found 3 matching tweets     │
│ 14:32:18 [INFO] Queued: @whale_alert $TUNA  │
│ 14:32:45 [INFO] Processing queue item...    │
│ 14:32:46 [INFO] Generated reply (142 chars) │
│ 14:32:48 [OK]   Reply posted: 18293847...   │
│ 14:33:02 [WARN] Author cooldown active      │
│ 14:33:15 [ERR]  Rate limit exceeded         │
└─────────────────────────────────────────────┘
```

### 4. Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/xxx.sql` | Create `x_bot_account_logs` table with RLS |
| `supabase/functions/x-bot-scan/index.ts` | Add log insertion calls |
| `supabase/functions/x-bot-reply/index.ts` | Add log insertion calls |
| `src/hooks/useXBotAccounts.ts` | Add `fetchLogs()` function |
| `src/components/admin/XBotActivityPanel.tsx` | Add "Console" tab with log display |

### 5. Auto-Cleanup
- Logs older than 7 days automatically deleted during scan runs
- Prevents database bloat while keeping recent history
