
## Fix: Standalone Catch-Up for Completed Launches Missing Replies

### Root Cause

The catch-up logic added previously is inside the tweet processing loop (lines 1232-1288 of `agent-scan-twitter` and similar in `agent-scan-mentions`). This only fires if the tweet appears in the current API scan batch (latest ~100 tweets). Since the completed-but-unreplied tweets (Woof, Sybil, PopcatInu) are now older than the latest 100 tweets, they never enter the loop and the catch-up never triggers.

### Solution

Add a **standalone catch-up query** that runs BEFORE the tweet loop in `agent-scan-twitter`. This query directly checks the database for any `agent_social_posts` with `status = 'completed'` that have no matching entry in `twitter_bot_replies`, then sends the missing replies.

### Changes

#### 1. `supabase/functions/agent-scan-twitter/index.ts`

Insert a new block AFTER the lock is acquired and credentials are set up (around line 1117, before the tweet sorting/processing loop), but only when `canPostReplies` is true:

```text
// ===== STANDALONE CATCH-UP: completed launches missing replies =====
if (canPostReplies) {
  // Find completed launches from last 48 hours with no reply
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: unrepliedPosts } = await supabase
    .from("agent_social_posts")
    .select("id, post_id, post_author, fun_token_id, parsed_name, parsed_symbol")
    .eq("platform", "twitter")
    .eq("status", "completed")
    .gt("created_at", cutoff)
    .not("fun_token_id", "is", null)
    .limit(5);  // Max 5 catch-ups per scan cycle

  if (unrepliedPosts && unrepliedPosts.length > 0) {
    for (const post of unrepliedPosts) {
      // Check if reply already exists
      const { data: alreadyReplied } = await supabase
        .from("twitter_bot_replies")
        .select("id")
        .eq("tweet_id", post.post_id)
        .maybeSingle();

      if (alreadyReplied) continue;

      // Fetch token details
      const { data: tokenData } = await supabase
        .from("fun_tokens")
        .select("mint_address, name, ticker")
        .eq("id", post.fun_token_id)
        .single();

      if (!tokenData?.mint_address) continue;

      const tokenName = tokenData.name || post.parsed_name || "Token";
      const tokenTicker = tokenData.ticker || post.parsed_symbol || "TOKEN";
      const replyText = `Token launched on $SOL!\n\n$${tokenTicker} - ${tokenName}\nCA: ${tokenData.mint_address}\n\nPowered by TUNA Agents - 80% of fees go to you! Launch your token on TUNA dot FUN`;

      const replyResult = await replyToTweet(
        post.post_id, replyText, ...credentials
      );

      if (replyResult.success && replyResult.replyId) {
        await supabase.from("twitter_bot_replies").insert({
          tweet_id: post.post_id,
          tweet_author: post.post_author,
          tweet_text: "(catch-up)",
          reply_text: replyText.slice(0, 500),
          reply_id: replyResult.replyId,
        });
        console.log(`[agent-scan-twitter] STANDALONE catch-up reply sent for ${post.post_id}`);
      }
    }
  }
}
```

#### 2. `supabase/functions/agent-scan-mentions/index.ts`

Add the same standalone catch-up block inside the lock, before the mentions loop. Uses the same pattern but with OAuth credentials instead of cookie-based auth.

### Why This Works

- Queries the database directly instead of relying on the Twitter API to return old tweets
- Runs every scan cycle (every 5 minutes) so missed replies get sent quickly
- Limited to 5 catch-ups per cycle and 48-hour window to avoid spam
- Dedup via `twitter_bot_replies` prevents double-replies
- Both scanners get the logic so whichever runs first sends the reply

### Files to modify
- `supabase/functions/agent-scan-twitter/index.ts` -- add standalone catch-up block before tweet loop
- `supabase/functions/agent-scan-mentions/index.ts` -- add standalone catch-up block before mentions loop

### Deployment
Both edge functions will be redeployed after changes.
