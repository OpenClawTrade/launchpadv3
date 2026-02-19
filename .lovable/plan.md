
## Update Account Handle: @buildclaw → @clawmode

### What to Change

**File:** `supabase/functions/agent-scan-twitter/index.ts`  
**Line 998** — The twitterapi.io mention query:

```ts
// BEFORE
const twitterApiIoMentionQuery = "(@tunalaunch OR @buildclaw) -is:retweet";

// AFTER
const twitterApiIoMentionQuery = "(@tunalaunch OR @clawmode) -is:retweet";
```

That's the only place `@buildclaw` appears. This query is used by the twitterapi.io fallback path to search for mentions of the bot account when the official Bearer Token search fails or is rate-limited.

### After the change

The function will be redeployed. The scanner will then:
- **Official X API path:** search for `!clawmode` keyword (already correct)
- **twitterapi.io mention fallback:** search for `@tunalaunch OR @clawmode` mentions (fixed)
- **Posting replies:** still via twitterapi.io cookies (unchanged)

No other files reference `@buildclaw`.
