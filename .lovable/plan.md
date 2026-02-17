

## Fix: Catch-Up Replies for Completed Launches Missing Replies

### Problem

When a tweet is processed and a token is successfully launched, but the reply fails (e.g., due to the base64 image bug), subsequent scans see the tweet as `status: "completed"` in `agent_social_posts` and skip it entirely -- never checking if a reply was actually sent.

The catch-up logic at line 1194-1233 of `agent-scan-twitter` only handles `status === "failed"`. There is zero handling for `status === "completed"` with a missing reply.

Same issue exists in `agent-scan-mentions` (line 453-455) -- no catch-up at all.

### Fix

Add catch-up reply logic for completed launches that are missing entries in `twitter_bot_replies`.

### Changes

#### 1. `supabase/functions/agent-scan-twitter/index.ts`

After the existing `failed` catch-up block (line 1230), add a new block for `completed` status:

```typescript
// Existing: catch-up for failed (help reply)
if (existing.status === "failed" && canPostReplies && username) {
  // ... existing help reply logic ...
}

// NEW: catch-up for completed launches missing a reply
if (existing.status === "completed" && canPostReplies && username) {
  const { data: alreadyReplied } = await supabase
    .from("twitter_bot_replies")
    .select("id")
    .eq("tweet_id", tweetId)
    .maybeSingle();

  if (!alreadyReplied) {
    // Fetch the launch details from agent_social_posts
    const { data: postData } = await supabase
      .from("agent_social_posts")
      .select("mint_address, token_name, token_ticker, image_url")
      .eq("id", existing.id)
      .single();

    if (postData?.mint_address) {
      const replyText = `Token launched on $SOL!\n\n$${postData.token_ticker || "TOKEN"} - ${postData.token_name || "Token"}\nCA: ${postData.mint_address}\n\nPowered by TUNA Agents! Launch your token on TUNA dot FUN`;

      // Send reply with image if available
      const replyResult = await replyToTweet(...);

      if (replyResult.success && replyResult.replyId) {
        await supabase.from("twitter_bot_replies").insert({...});
        console.log("Catch-up success reply sent");
      }
    }
  }
}
```

#### 2. `supabase/functions/agent-scan-mentions/index.ts`

Add the same catch-up logic at line 453 (currently just does `continue` with no checks):

```typescript
if (existing) {
  // NEW: catch-up for completed launches missing a reply
  if (existing.status === "completed") {
    const { data: alreadyReplied } = await supabase
      .from("twitter_bot_replies")
      .select("id")
      .eq("tweet_id", tweetId)
      .maybeSingle();

    if (!alreadyReplied) {
      // Fetch mint details and send catch-up reply
      // ... same pattern as above ...
    }
  }
  results.push({ tweetId, status: "already_processed" });
  continue;
}
```

### Technical Details

- Need to check which columns exist on `agent_social_posts` for retrieving mint_address/token_name/token_ticker (the data needed for the reply text)
- Both scanners get the same catch-up logic so whichever runs first will send the missed reply
- The `twitter_bot_replies` dedup check prevents double-replies if both scanners try

### Files to modify
- `supabase/functions/agent-scan-twitter/index.ts`
- `supabase/functions/agent-scan-mentions/index.ts`

