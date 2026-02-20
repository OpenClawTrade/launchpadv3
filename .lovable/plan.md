

## Simplify Token Launch Replies to Official X API Only

### What's Changing
The current reply system tries the Official X API first, then falls back through 3 different twitterapi.io methods (create_tweet_v2, create_tweet, post_tweet). This adds complexity and all the fallbacks are failing anyway. We'll strip out all twitterapi.io reply logic and use **only** the Official X API (OAuth 1.0a) for token launch replies.

### Step 1: Update OAuth Secrets
You'll be prompted to enter fresh values for these 4 secrets from your new X Developer Portal console:
1. TWITTER_CONSUMER_KEY (API Key)
2. TWITTER_CONSUMER_SECRET (API Key Secret)  
3. TWITTER_ACCESS_TOKEN
4. TWITTER_ACCESS_TOKEN_SECRET

Make sure your app has **"Read and Write"** permissions enabled in the developer portal.

### Step 2: Simplify `replyToTweet()` in `agent-scan-twitter`
**File:** `supabase/functions/agent-scan-twitter/index.ts`

Replace the entire `replyToTweet()` function (lines 487-800) with a clean version that:
- Uses ONLY the Official X API via `replyViaOfficialApi()` (already exists at line 119)
- Keeps retry logic for transient errors (429/5xx/timeouts)
- Removes all twitterapi.io fallback code (~250 lines deleted)
- Removes the `loginCookies`, `authSession`, and `apiKey` parameters since they're no longer needed for replies
- Keeps `mediaUrl` parameter signature for compatibility but logs a warning (Official X API v2 text-only for now)

### Step 3: Update all `replyToTweet()` call sites
Update every place that calls `replyToTweet()` to pass only the required OAuth credentials, removing the twitterapi.io-specific parameters.

### What Stays the Same
- The `agent-scan-twitter` function still uses twitterapi.io for **reading/scanning** tweets (search endpoint) -- that's separate from replies
- The `replyViaOfficialApi()` helper function (lines 119-180) stays as-is
- Deduplication logic, rate limiting, and catch-up loop are untouched
- The `agent-hourly-post` function continues using twitterapi.io for posting (separate concern)

### Technical Details

Simplified `replyToTweet()`:
```typescript
async function replyToTweet(
  tweetId: string,
  text: string,
  oauthCreds: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string },
  username?: string,
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`[agent-scan-twitter] Attempting reply via Official X API to @${username || "unknown"} (tweet ${tweetId})`);
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await replyViaOfficialApi(
        tweetId, text,
        oauthCreds.consumerKey, oauthCreds.consumerSecret,
        oauthCreds.accessToken, oauthCreds.accessTokenSecret
      );
      if (res.success && res.replyId) {
        console.log(`[agent-scan-twitter] Reply sent via Official X API: ${res.replyId}`);
        return res;
      }
      // Retry only on transient errors
      const isTransient = res.error && (/429|5\d{2}/.test(res.error) || /timeout|gateway/i.test(res.error));
      if (!isTransient || attempt === 2) return res;
      await sleep(600 * Math.pow(2, attempt - 1) + Math.random() * 200);
    }
    return { success: false, error: "Unknown retry error" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
```

Call sites will be updated to pass only `oauthCreds` instead of the full parameter list with loginCookies, apiKey, authSession, etc.

