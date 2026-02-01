

# Fix TUNA Agents: Social Post Detection System (Clawnch Clone)

## Problem Statement

The current implementation uses API key authentication and direct API calls, but the original Clawnch system works differently:

**Clawnch workflow:**
1. Agent posts `!clawnch` + metadata on MoltBook/4claw/Moltx
2. Clawnch bot auto-scans these platforms every minute
3. Token deployed automatically when post detected
4. No API registration or key required for launching

**Current TUNA Agents workflow (incorrect):**
1. Agent calls `/agent-register` to get API key
2. Agent calls `/agent-launch` with API key header
3. Token deployed

## What Needs to Change

### 1. Add Social Platform Detection

Create a bot/worker that scans for `!tunalaunch` posts on:
- **Twitter/X** - Scan mentions of @TunaFun or hashtag
- **Telegram** - Bot in a public channel

Post format to detect:
```text
!tunalaunch
name: Cool Token
symbol: COOL
wallet: 7xK9abc123...
description: The coolest token on Solana
image: https://example.com/logo.png
website: https://cooltoken.com
twitter: @cooltoken
```

### 2. New Edge Functions

| Function | Purpose |
|----------|---------|
| `agent-scan-twitter` | Cron job to scan Twitter for !tunalaunch mentions |
| `agent-scan-telegram` | Webhook receiver for Telegram bot messages |
| `agent-process-post` | Parse detected post and trigger token launch |

### 3. Modify Launch Flow

```text
Current Flow:
Agent → API Key → /agent-launch → Token Created

New Flow (matching Clawnch):
Agent posts on Twitter/Telegram
   ↓
Bot detects "!tunalaunch"
   ↓
Parse post for: name, symbol, wallet, image
   ↓
Launch token attributed to wallet
   ↓
Reply to post with token links
```

### 4. Keep API as Optional

The existing API system can remain as an **alternative** for developers who prefer direct integration, but the **primary** launch method should be social post detection (like Clawnch).

### 5. Update Documentation

The docs page should primarily explain the social post format:

```text
## Launch via Twitter

Post a tweet mentioning @TunaFun with the !tunalaunch command:

!tunalaunch
name: My Token
symbol: TOKEN
wallet: 7xK9...
description: My awesome token
image: https://...

The bot will detect your post and launch the token automatically.
You'll receive a reply with your token links.
```

### 6. Agent Attribution

When launching via social post:
- Extract `wallet` from post content
- Look up or create agent by wallet address
- No API key required for launching
- 80/20 fee split still applies

---

## Technical Implementation

### Twitter Bot (Scan Mode)

```text
supabase/functions/agent-scan-twitter/index.ts

- Cron trigger every 1-5 minutes
- Use Twitter API to search for "!tunalaunch"
- Filter to posts not yet processed
- For each new post:
  - Parse metadata (name, symbol, wallet, etc.)
  - Call existing launch logic
  - Reply to tweet with token URLs
  - Mark post as processed
```

### Telegram Bot (Webhook Mode)

```text
supabase/functions/agent-telegram-webhook/index.ts

- Webhook endpoint for Telegram bot
- Listen for messages containing "!tunalaunch"
- Parse message for token metadata
- Launch token
- Reply in chat with token links
```

### Database Changes

Add table to track processed posts:
```sql
CREATE TABLE agent_social_posts (
  id UUID PRIMARY KEY,
  platform TEXT NOT NULL, -- 'twitter' or 'telegram'
  post_id TEXT NOT NULL UNIQUE,
  post_url TEXT,
  wallet_address TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  fun_token_id UUID REFERENCES fun_tokens(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Summary

The fix transforms TUNA Agents from an API-first system to a social-post-triggered system that matches how Clawnch actually works:

| Feature | Current (Wrong) | Fixed (Correct) |
|---------|-----------------|-----------------|
| Primary trigger | API call with key | Social post detection |
| Registration | Required before launch | Optional (auto-created from wallet) |
| User experience | Developer-focused | Agent-focused (just post!) |
| Platforms | None | Twitter + Telegram |

The existing API endpoints can remain as an alternative path for developers who want direct integration, but the main UX should mirror Clawnch: **post and it just works**.

