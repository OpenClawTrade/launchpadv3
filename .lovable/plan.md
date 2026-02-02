

# Fix Twitter Auto-Reply to Use twitterapi.io

The auto-reply for "missing format" help messages was implemented using the official X.com OAuth API, but your account is set up to post via **twitterapi.io** using session tokens.

---

## Current Issue

The `replyToTweet` function in `agent-scan-twitter` uses:
```text
Endpoint: https://api.x.com/2/tweets
Auth: OAuth 1.0a (TWITTER_CONSUMER_KEY, etc.)
Status: These credentials are NOT configured
```

But `twitter-mention-launcher` already posts successfully using:
```text
Endpoint: https://api.twitterapi.io/twitter/tweet/create
Auth: X_AUTH_TOKEN + X_CT0_TOKEN
Status: Already configured and working ✅
```

---

## Solution

Update `agent-scan-twitter` to use the same twitterapi.io posting method.

### File to Update

**supabase/functions/agent-scan-twitter/index.ts**

Replace the `replyToTweet` function to use twitterapi.io:

```text
Before: OAuth 1.0a signature generation + api.x.com
After: Simple POST to twitterapi.io with session tokens
```

### New Implementation Pattern

```typescript
async function replyToTweet(
  tweetId: string, 
  text: string
): Promise<boolean> {
  const authToken = Deno.env.get("X_AUTH_TOKEN");
  const ct0Token = Deno.env.get("X_CT0_TOKEN");
  const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");

  if (!authToken || !ct0Token || !apiKey) {
    console.error("[agent-scan-twitter] Missing X session tokens");
    return false;
  }

  const response = await fetch(
    "https://api.twitterapi.io/twitter/tweet/create",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        auth_token: authToken,
        ct0: ct0Token,
        text: text,
        reply_to_tweet_id: tweetId,
      }),
    }
  );

  return response.ok;
}
```

---

## Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/agent-scan-twitter/index.ts` | Replace OAuth-based `replyToTweet` with twitterapi.io session-based posting |

---

## No New Credentials Needed

Your existing secrets are sufficient:
- `TWITTERAPI_IO_KEY` ✅
- `X_AUTH_TOKEN` ✅  
- `X_CT0_TOKEN` ✅

---

## Expected Result

When someone tweets `!tunalaunch` without proper format, the bot will successfully reply with helpful instructions using the same posting mechanism that already works for token launch confirmations.

