

# Strict Image Requirement: Block X Launches Without User-Provided Image

## Current Behavior (Problem)

When a user tweets `!tunalaunch` without attaching an image:
1. System detects no image in tweet
2. Falls back to AI image generation
3. If AI succeeds → Token launches with AI-generated image
4. User had no control over the mascot/branding

For EPST specifically - the tweet had no image attached, but AI generated one and launched anyway.

## New Behavior (Requested)

**Require user to attach image to their tweet. No AI fallback.**

```text
LAUNCH FLOW (Updated)
─────────────────────
@user tweets with image attached:
  "!tunalaunch @BuildTuna
   Name: MyToken
   Symbol: MTK"
   [attached image.jpg]

→ System extracts attached image ✅
→ Token launches with user's image

@user tweets WITHOUT image:
  "!tunalaunch @BuildTuna
   Name: MyToken  
   Symbol: MTK"

→ System detects no image ❌
→ BLOCKED: "Please attach an image to your tweet"
→ Reply to user explaining requirement
```

---

## Technical Changes

### File: `supabase/functions/agent-process-post/index.ts`

**Remove AI fallback logic and block immediately when no image is provided:**

Current code (lines 510-533):
```typescript
// If no image from tweet, try AI generation  
if (!finalImageUrl) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableApiKey) {
    finalImageUrl = await generateTokenImageWithAI(...);
    // ... AI generation logic
  }
}
```

New code:
```typescript
// STRICT: Require user to provide image in tweet - no AI fallback
if (!finalImageUrl) {
  const errorMsg = "Please attach an image to your tweet. Token launches require a custom image.";
  console.log(`[agent-process-post] ❌ BLOCKED - No image attached to tweet: ${parsed.name} (${parsed.symbol})`);
  
  // Insert as failed record
  const { data: failedPost } = await supabase
    .from("agent_social_posts")
    .insert({
      platform,
      post_id: postId,
      post_url: postUrl,
      post_author: postAuthor,
      post_author_id: postAuthorId,
      wallet_address: parsed.wallet,
      raw_content: rawContent.slice(0, 1000),
      parsed_name: parsed.name,
      parsed_symbol: parsed.symbol,
      parsed_description: parsed.description,
      parsed_image_url: null,
      parsed_website: parsed.website,
      parsed_twitter: parsed.twitter,
      status: "failed",
      error_message: errorMsg,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  return {
    success: false,
    error: errorMsg,
    socialPostId: failedPost?.id,
    shouldReply: true,  // Flag to reply to user explaining requirement
    replyText: "🐟 To launch a token, please attach an image to your tweet!\n\nRequired format:\n!tunalaunch @BuildTuna\nName: TokenName\nSymbol: TKN\n[Attach your token image]"
  };
}
```

### Add Reply Logic for Failed Launches

When launch is blocked due to missing image, reply to the user explaining what's needed. This happens in `agent-scan-twitter` and `agent-scan-mentions` where the post is processed.

**File: `supabase/functions/agent-scan-twitter/index.ts`** (and `agent-scan-mentions`)

After calling `agent-process-post`, check if `shouldReply` is set and send helpful reply:

```typescript
const processResult = await processResponse.json();

if (!processResult.success && processResult.shouldReply && processResult.replyText) {
  // Reply to user explaining why launch failed
  await replyToTweet(
    tweetId,
    processResult.replyText,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );
}
```

---

## What Gets Removed

1. **AI image generation fallback** - The `generateTokenImageWithAI` function call when no tweet image is found
2. **Silent acceptance** - No more launching tokens without user-provided images

## What Gets Added

1. **Immediate blocking** - Fail fast when no image attached
2. **User feedback** - Reply to tweet explaining the requirement
3. **Clear error messages** - In dashboard and logs

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/agent-process-post/index.ts` | Remove AI fallback, block when no image, return shouldReply flag |
| `supabase/functions/agent-scan-twitter/index.ts` | Reply to user when launch blocked |
| `supabase/functions/agent-scan-mentions/index.ts` | Reply to user when launch blocked |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Tweet with attached PNG/JPG | ✅ Proceed with launch |
| Tweet with t.co shortlink | ❌ Blocked (shortlinks already filtered) |
| Tweet with no image at all | ❌ Blocked + Reply with instructions |
| Tweet with external image URL | ✅ Proceed (if not t.co) |

