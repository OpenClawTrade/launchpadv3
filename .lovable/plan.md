
## Re-enable X-Bot for @clawmode + Manual Reply to Tweet

### Current State

The database shows only one bot account configured: **@ai67x_fun** (`is_active: false`, `rules.enabled: false`). There is **no @clawmode account** in the `x_bot_accounts` table — the @clawmode account needs to be added with its credentials.

The kill switches `ENABLE_X_POSTING` and `ENABLE_PROMO_MENTIONS` are set as secrets but their current values are unknown (secrets are encrypted). The cron jobs (`x-bot-scan-1min`, `x-bot-reply-1min`) were deleted and need to be re-created.

The `x-manual-reply` edge function already exists and uses `X_FULL_COOKIE`, `X_AUTH_TOKEN`, `X_CT0_TOKEN` from secrets — and all three of those secrets ARE configured. It also requires `TWITTER_PROXY` (also configured).

The `x-bot-scan` reads from `x_bot_accounts` where `is_active = true`, builds a search query from each account's `monitored_mentions` + `tracked_cashtags` + `tracked_keywords`, then queues matching tweets. The `x-bot-reply` then generates AI replies and posts them via twitterapi.io using `create_tweet_v2` with cookie-based auth.

---

### What Will Be Done

**Step 1 — Add @clawmode account to the database**

Insert a new row in `x_bot_accounts` for @clawmode using the existing `X_AUTH_TOKEN`, `X_CT0` and `X_FULL_COOKIE` secrets (these are stored as secrets and referenced from the edge function). The account will be set `is_active: true`.

Then insert its rules in `x_bot_account_rules`:
- `monitored_mentions`: `[@clawmode, @BuildClaw, @openclaw, @moltbook]`
- `tracked_cashtags`: `[$CLAW, $SOL, $OPENCLAW]`
- `min_follower_count`: 5000
- `require_blue_verified`: true
- `require_gold_verified`: false
- `author_cooldown_hours`: 6
- `enabled`: true

**Step 2 — Enable kill switches**

Update both `ENABLE_X_POSTING` and `ENABLE_PROMO_MENTIONS` secrets to `"true"`.

**Step 3 — Re-create the cron jobs**

Create two cron jobs via SQL:
- `x-bot-scan-1min` — every 1 minute → calls `x-bot-scan`
- `x-bot-reply-1min` — every 1 minute → calls `x-bot-reply`

**Step 4 — Manual one-off reply to the specific tweet**

Immediately call `x-manual-reply` with `tweet_id: "2023792171493847514"` and an AI-drafted reply in the @clawmode sharp crypto-native voice. The reply will be generated inline in the edge function call.

**Step 5 — Update the Admin UI to show @clawmode targets**

The X-Bot admin panel (`useXBotAccounts` hook + the admin page) already loads accounts + rules. Once @clawmode is inserted into the DB, it will appear automatically in the admin UI showing exactly which @tags, $cashtags it monitors.

---

### Auto-Reply Targets (what @clawmode will reply to)

After re-enabling, the bot will scan for tweets containing **any** of:

| Type | Values |
|---|---|
| Mentions | `@clawmode` `@BuildClaw` `@openclaw` `@moltbook` |
| Cashtags | `$CLAW` `$SOL` `$OPENCLAW` |

Filters applied:
- Author must have **5,000+ followers**
- Author must have **blue verified badge**
- Tweet must be **non-reply**, **non-retweet**
- Tweet must be **< 30 minutes old** (first scan) / newer than last scan timestamp
- **6-hour author cooldown** (won't reply to same person within 6h)
- Won't reply to own tweets

---

### Technical Details

- The `x-manual-reply` function reads credentials directly from secrets (`X_FULL_COOKIE`, `X_AUTH_TOKEN`, `X_CT0_TOKEN`, `TWITTER_PROXY`, `TWITTERAPI_IO_KEY`) — all are already configured
- The `x-bot-reply` function reads credentials from `x_bot_accounts.full_cookie_encrypted` column — so we store the same cookie values there
- The `x-bot-scan` uses `TWITTERAPI_IO_KEY` (already configured) to call twitterapi.io's advanced search
- Cron jobs will be inserted directly via SQL (not via migration tool, as they contain project-specific URLs)

### Files to Modify

- No frontend files need changing — the admin UI already supports this via `useXBotAccounts`
- Database: insert into `x_bot_accounts` + `x_bot_account_rules`
- SQL: create 2 cron jobs
- Secrets: set `ENABLE_X_POSTING=true`, `ENABLE_PROMO_MENTIONS=true`
- Immediately invoke `x-manual-reply` for the specific tweet
