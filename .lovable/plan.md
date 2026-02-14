

# Fix Influencer List Reply System

## What's broken

The function exists and is cron'd every 10 min, but has **never sent a single reply**. Three root causes:

1. **Tweet parsing misses the actual API format** -- `twitterapi.io/twitter/user/last_tweets` returns `{ data: { tweets: [...] } }` but the code tries `tweetsData.tweets`, `tweetsData.data` (as array), etc. Never finds the actual tweets array.
2. **Cookie handling is wrong** -- does `btoa(X_FULL_COOKIE)` raw instead of parsing cookies into JSON first (like x-bot-reply does).
3. **No member pagination** -- only fetches first page (~20 members), ignores `next_cursor`.
4. **Old corporate prompt** -- still says "subtly mention TUNA.fun as a meme coin launchpad."

## Changes

### 1. Rewrite `influencer-list-reply/index.ts`

**Tweet extraction fix:**
- Handle `tweetsData.data.tweets` (the actual format) as primary path
- Keep fallbacks for other formats
- Log actual response keys on first member for debugging

**Cookie handling fix:**
- Port `parseCookieString` + `buildLoginCookiesBase64` from the working `x-bot-reply` function
- Parse `X_FULL_COOKIE` into JSON object, then base64 encode

**Member pagination:**
- After first page, follow `has_next_page` / `next_cursor` to fetch all members (cap at 200)
- Store full member list for scanning

**Reply prompt update:**
Replace the corporate prompt with:
```
System: You're a sharp, opinionated crypto native who actually knows their shit.
Generate a reply (max 240 chars).

Rules:
- Strong opinions. Commit to a take. No hedging.
- Never open with "Great question" or "Absolutely". Just answer.
- Brevity mandatory. One sentence if it fits.
- Natural wit allowed, not forced jokes.
- Call things out. Charm over cruelty, no sugarcoat.
- Swearing allowed when it lands. Don't force it.
- Do NOT mention tuna, TUNA, any launchpad, platform, agent, or product.
- No taglines, signatures, hashtags, or calls to action.

Be the reply you'd actually want to read at 2am.
Not a corporate drone. Not a sycophant. Just... good.
```

Use system/user message split (not single prompt).

### 2. Update cron schedule

Change from `*/10 * * * *` to `*/30 * * * *` (every 30 minutes as requested).

### 3. Deploy the function

The function currently isn't deployed -- deploy it so the cron can actually invoke it.

## Technical Details

**Files modified:**
- `supabase/functions/influencer-list-reply/index.ts` -- full rewrite of tweet parsing, cookie handling, prompt, and pagination

**Database migration:**
- Update `cron.job` schedule from `*/10` to `*/30`
- Update `influencer_list_config.reply_interval_minutes` from 10 to 30

**No new tables needed** -- existing `influencer_list_config` and `influencer_replies` tables are sufficient.

