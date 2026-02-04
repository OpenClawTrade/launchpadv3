
# @moltbook/@openclaw Promo Mention Reply System

## Overview

Create an automated Twitter reply system that monitors tweets mentioning `@moltbook` or `@openclaw`, generates human-like conversational AI replies ending with "Tuna Launchpad for AI Agents on Solana.", and engages in follow-up conversations with users who reply (up to 2 additional replies per thread).

---

## Architecture

```text
┌───────────────────────────────────────────────────────────────────┐
│                 pg_cron Job (Every 1 Minute)                       │
│         net.http_post → promo-mention-reply Edge Function          │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                 promo-mention-reply Edge Function                  │
│  1. Search: "(@moltbook OR @openclaw) -is:retweet" via            │
│     twitterapi.io advanced_search (same as !launchtuna)           │
│  2. Filter: tweets from last 30 min, not already replied          │
│  3. Check for follow-up replies to our previous responses         │
│  4. Generate AI reply via Lovable AI (openai/gpt-5-mini)          │
│  5. Post reply via twitterapi.io create_tweet_v2                  │
│  6. Track in promo_mention_replies table                          │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                   promo_mention_replies Table                      │
│  - Deduplication via unique tweet_id                              │
│  - Thread tracking via conversation_id                            │
│  - Max 3 replies per thread (initial + 2 follow-ups)              │
│  - Cross-check with twitter_bot_replies                           │
└───────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Table: `promo_mention_replies`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| tweet_id | text | Unique - the tweet we replied to |
| tweet_author | text | Username of tweet author |
| tweet_author_id | text | Author's X user ID |
| tweet_text | text | Original tweet content (truncated) |
| conversation_id | text | Thread root ID for grouping follow-ups |
| reply_id | text | Our reply's tweet ID |
| reply_text | text | What we replied |
| reply_type | text | "initial" / "followup_1" / "followup_2" |
| mention_type | text | "moltbook" / "openclaw" / "both" |
| status | text | "pending" / "sent" / "failed" |
| error_message | text | Error details if failed |
| created_at | timestamptz | When we created this record |

**Indexes:**
- Unique constraint on `tweet_id`
- Index on `conversation_id` for thread lookups
- Index on `tweet_author_id` for author rate limiting

---

## Edge Function: `promo-mention-reply`

### Search Strategy (using twitterapi.io)

Following the exact pattern from `twitter-mention-launcher` and `agent-scan-twitter`:

```typescript
const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
searchUrl.searchParams.set("query", "(@moltbook OR @openclaw) -is:retweet");
searchUrl.searchParams.set("queryType", "Latest");

const response = await fetch(searchUrl.toString(), {
  headers: { "X-API-Key": TWITTERAPI_IO_KEY }
});
```

### Deduplication Layers

1. **Primary**: Skip if `tweet_id` already in `promo_mention_replies`
2. **Cross-check**: Skip if `tweet_id` in `twitter_bot_replies`
3. **Bot filter**: Skip tweets from buildtuna, tunalaunch, moltbook, openclaw
4. **Signature filter**: Skip tweets containing our tagline
5. **Hourly limit**: Max 20 replies per hour globally
6. **Author limit**: Max 1 initial reply per author per 6 hours

### Follow-up Reply Logic

After processing new mentions, scan for replies TO our previous tweets:
1. Query `promo_mention_replies` for recent `reply_id` values where `reply_type != 'followup_2'`
2. For each, search for replies to that tweet
3. If the original author replied and we haven't hit 3 total replies in that thread, respond

### AI Reply Generation

Using Lovable AI (no API key required):

```typescript
const prompt = `You are a friendly crypto community member. Generate a short, 
conversational reply (max 250 chars) to this tweet. Be relevant and add value.
Do NOT be promotional or spammy. Sound human and authentic.

Tweet by @${username}: "${tweetText}"

End your reply with exactly: "Tuna Launchpad for AI Agents on Solana."

Reply:`;

const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 100,
  }),
});
```

### Reply Posting

Using the same twitterapi.io endpoints as existing functions:

```typescript
const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": TWITTERAPI_IO_KEY,
  },
  body: JSON.stringify({
    login_cookies: loginCookiesBase64,
    tweet_text: replyText,
    reply_to_tweet_id: tweetId,
    proxy: TWITTER_PROXY,
  }),
});
```

---

## Admin Dashboard: `/admin/promo-mentions`

Similar to the existing Influencer Replies admin page:

### Features
- **Stats cards**: Replies/Hour, Successful, Failed, Threads Active
- **Enable/Disable toggle**: Controls `ENABLE_PROMO_MENTIONS` behavior
- **Recent replies table** with:
  - Tweet author, original text, our reply
  - Reply type badge (initial/followup_1/followup_2)  
  - Status badge (sent/failed/pending)
  - Links to view on X
- **Run Now button** with debug output panel
- **Configuration card** showing limits and settings

---

## Cron Job Setup

Schedule a 1-minute cron to catch fresh tweets:

```sql
SELECT cron.schedule(
  'promo-mention-reply-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ptwytypavumcrbofspno.supabase.co/functions/v1/promo-mention-reply',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## Safety Measures

1. **Kill switch**: `ENABLE_PROMO_MENTIONS` env var must be "true"
2. **Master kill switch**: Respects existing `ENABLE_X_POSTING` 
3. **Rate limits**:
   - 20 replies per hour maximum
   - 1 initial reply per author per 6 hours
   - Max 3 replies per conversation thread
4. **Bot detection**: Skip known bot accounts
5. **Self-reply prevention**: Never reply to own tweets
6. **Cron lock**: Prevent concurrent executions using `cron_locks` table
7. **Time budget**: 25-second max execution to avoid gateway timeouts

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Migration SQL | Execute | Create `promo_mention_replies` table |
| `supabase/functions/promo-mention-reply/index.ts` | Create | Main edge function |
| `src/pages/PromoMentionsAdminPage.tsx` | Create | Admin dashboard |
| `src/App.tsx` | Modify | Add route for admin page |
| Cron SQL | Execute | Schedule 1-minute job |

---

## Verification Steps

After implementation:
1. Deploy edge function
2. Create database table and cron job
3. Set `ENABLE_PROMO_MENTIONS=true` in secrets
4. Navigate to `/admin/promo-mentions`
5. Click "Run Now" to test
6. Verify debug panel shows tweets found
7. Check `promo_mention_replies` table for records
8. Verify reply appears on X
9. Test follow-up by replying to the bot's reply
10. Confirm max 2 follow-ups enforced

---

## Technical Details for Reference

### Reply Format Examples

**Initial Reply:**
```
Great insight on agent development! The intersection of AI and 
on-chain execution is fascinating. Tuna Launchpad for AI Agents on Solana.
```

**Follow-up Reply:**
```
Exactly! That's why transparent tokenomics matter so much in this space. 
Tuna Launchpad for AI Agents on Solana.
```

### Environment Variables Required
- `TWITTERAPI_IO_KEY` (already configured)
- `X_FULL_COOKIE` (already configured)
- `TWITTER_PROXY` (already configured)
- `LOVABLE_API_KEY` (already configured)
- `ENABLE_PROMO_MENTIONS` (new - to be added)
