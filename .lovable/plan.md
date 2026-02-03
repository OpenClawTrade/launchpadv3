

# Plan: Fix X Reply Format - No Links, Full CA, Token Image

## Current Issues (from screenshot)

1. **Truncated CA**: Shows `$FoK9hbTT...` instead of full contract address
2. **Link in text**: Contains `🔗 Trade: tuna.fun/launchpad/FoK9...` (user wants NO links)
3. **No token image**: Reply is text-only, no image attached

## Solution Overview

Update the success reply to:
- Display the **full contract address** (CA)
- **Remove all links** from the reply text  
- **Attach the token image** as media

### New Reply Format

```text
🐟 Token launched!

$TICKER - TokenName
CA: FoK9hbTT...abcd1234 (FULL 44-char address)

Powered by TUNA Agents - 80% of fees go to you!
```

Plus the token image attached as media.

---

## Implementation Details

### Step 1: Update `agent-process-post` Return Object

**File**: `supabase/functions/agent-process-post/index.ts`

Add `tokenName`, `tokenSymbol`, and `imageUrl` to the return object so scanners can build the new reply format:

```typescript
// Change from (line 1186-1191):
return {
  success: true,
  mintAddress,
  tradeUrl,
  socialPostId,
};

// To:
return {
  success: true,
  mintAddress,
  tradeUrl,
  socialPostId,
  tokenName: cleanName,     // NEW: Full token name
  tokenSymbol: cleanSymbol, // NEW: Ticker/symbol  
  imageUrl: finalImageUrl,  // NEW: Re-hosted token image URL
};
```

### Step 2: Update `replyToTweet` Function Signature

**File**: `supabase/functions/agent-scan-twitter/index.ts`

Add optional `mediaUrl` parameter to support image attachments:

```typescript
async function replyToTweet(
  tweetId: string,
  text: string,
  apiKey: string,
  loginCookies: string,
  proxyUrl: string,
  username?: string,
  authSession?: { authToken: string; ct0: string },
  oauthCreds?: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string },
  mediaUrl?: string  // NEW: Optional image URL to attach
): Promise<{ success: boolean; replyId?: string; error?: string }>
```

### Step 3: Pass `media_url` to twitterapi.io Endpoints

**File**: `supabase/functions/agent-scan-twitter/index.ts`

Update `tryCreateTweetV2` and `tryPostTweetLoginCookies` functions to include `media_url` when provided:

```typescript
const tryCreateTweetV2 = async (): Promise<{ ok: boolean; replyId?: string; error?: string }> => {
  if (!loginCookies) return { ok: false, error: "Missing login_cookies" };

  const body: any = {
    login_cookies: loginCookies,
    tweet_text: text,
    reply_to_tweet_id: tweetId,
    proxy: proxyUrl,
  };
  
  // NEW: Attach image if provided
  if (mediaUrl) {
    body.media_url = mediaUrl;
  }

  const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, { ... });
```

### Step 4: Update Success Reply Format

**File**: `supabase/functions/agent-scan-twitter/index.ts` (line ~1212)

```typescript
// OLD format:
const replyText = `🐟 Token launched!\n\n$${processResult.mintAddress?.slice(0, 8)}... is now live on TUNA!\n\n🔗 Trade: ${processResult.tradeUrl}\n\nPowered by TUNA Agents - 80% of fees go to you!`;

// NEW format (no links, full CA, includes token name/ticker):
const replyText = `🐟 Token launched!\n\n$${processResult.tokenSymbol} - ${processResult.tokenName}\nCA: ${processResult.mintAddress}\n\nPowered by TUNA Agents - 80% of fees go to you!`;
```

### Step 5: Pass Image URL to Reply Function

**File**: `supabase/functions/agent-scan-twitter/index.ts` (line ~1214-1222)

```typescript
const replyResult = await replyToTweet(
  tweetId,
  replyText,
  twitterApiIoKey || "",
  loginCookies || "",
  proxyUrl || "",
  username,
  replyAuthSession,
  oauthCreds,
  processResult.imageUrl  // NEW: Attach token image
);
```

### Step 6: Update `agent-scan-mentions` (Backup Scanner)

**File**: `supabase/functions/agent-scan-mentions/index.ts`

Same changes:
1. Update `replyToTweet` function signature to accept `mediaUrl`
2. Update success reply text format (no links, full CA)
3. Pass `processResult.imageUrl` to the reply function

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/agent-process-post/index.ts` | Add `tokenName`, `tokenSymbol`, `imageUrl` to return object |
| `supabase/functions/agent-scan-twitter/index.ts` | Update `replyToTweet` signature, add `media_url` to API calls, update reply format |
| `supabase/functions/agent-scan-mentions/index.ts` | Same changes as scan-twitter (backup scanner consistency) |

---

## New Reply Example

**Before** (current):
```
🐟 Token launched!

$FoK9hbTT... is now live on TUNA!

🔗 Trade: tuna.fun/launchpad/FoK9...

Powered by TUNA Agents - 80% of fees go to you!
```

**After** (new):
```
🐟 Token launched!

$PEPE - PepeCoin
CA: FoK9hbTTxyz123abc456def789ghi012jkl345mno678

Powered by TUNA Agents - 80% of fees go to you!

[Token Image Attached]
```

---

## Technical Notes

- The `create_tweet_v2` endpoint from twitterapi.io accepts a `media_url` parameter (already used in `twitter-mention-launcher` and `promote-post`)
- Token images are already re-hosted to Supabase storage via `rehostImageIfNeeded()`, ensuring reliable URLs
- The Official X API (OAuth 1.0a) may require separate media upload flow - if that path is used, image attachment will be skipped gracefully

