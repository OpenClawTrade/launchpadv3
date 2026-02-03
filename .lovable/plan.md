

# Plan: Fix X Spam Issue & Prevent Future Incidents

## Root Cause Analysis

**What happened**: The bot sent **135+ self-replies** within 10 minutes due to a **recursive reply loop**.

### The Spam Chain
1. User tweets `!tunalaunch` without proper format
2. Bot replies with help message containing `!tunalaunch` example text
3. Scanner picks up bot's OWN reply (because it contains "tunalaunch")
4. Bot replies to its own reply with another help message
5. Repeat indefinitely → **135 recursive self-replies**

### Why Existing Safeguards Failed
| Safeguard | Why It Failed |
|-----------|---------------|
| Deduplication (`twitter_bot_replies` table) | Each new bot reply had a **different tweet_id** - not a duplicate |
| `agent_social_posts` check | Each bot reply was a **new post** to process |
| Rate limiting | Per-author limit only - bot account had no limit |

### Additional Gap Found
- **`agent-scan-mentions`** function is **MISSING the kill switch** (`ENABLE_X_POSTING` check)
- Only `agent-scan-twitter` and `x-manual-reply` have the kill switch
- If `ENABLE_X_POSTING` is not set, `agent-scan-mentions` will STILL send replies via OAuth API

---

## Implementation Plan

### 1. Add Kill Switch to `agent-scan-mentions`
Add the same emergency kill switch that exists in `agent-scan-twitter`:

```text
Location: supabase/functions/agent-scan-mentions/index.ts
After line 247 (after credentials check)

Add:
  // Emergency kill-switch: disable ALL X posting/replying unless explicitly enabled.
  const postingEnabled = Deno.env.get("ENABLE_X_POSTING") === "true";
  if (!postingEnabled) {
    console.log("[agent-scan-mentions] 🚫 X posting disabled - skipping entirely");
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: "posting_disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
```

### 2. Add Global Hourly Reply Limit
Implement a hard cap on total replies per hour to prevent any future runaway situations:

```text
Location: supabase/functions/agent-scan-twitter/index.ts
Before processing any tweets

Add check:
  // Safety: Max 30 replies per hour globally
  const { count: recentReplies } = await supabase
    .from("twitter_bot_replies")
    .select("*", { count: "exact", head: true })
    .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  if ((recentReplies || 0) >= 30) {
    console.warn("[agent-scan-twitter] ⚠️ Global hourly limit reached (30 replies/hour)");
    return { success: true, skipped: true, reason: "global_rate_limit" };
  }
```

### 3. Add Per-Minute Reply Burst Protection
Stop runaway loops within seconds:

```text
Add check for max 5 replies per minute globally
This catches any spam loop before it gets out of control
```

### 4. Expand Bot Username Blocklist
Add all known bot-related patterns:

```text
const botUsernames = [
  "buildtuna", "tunalaunch", "tunabot", 
  "tuna_launch", "build_tuna", "tunaagent"
];
```

### 5. Add Reply Content Filter
Prevent bot from replying to any tweet that contains its own reply template text:

```text
// Skip tweets that look like our own replies
const botReplySignatures = [
  "🐟 Hey @",
  "🐟 Token launched!",
  "🐟 To launch a token",
  "Powered by TUNA Agents"
];

if (botReplySignatures.some(sig => tweetText.includes(sig))) {
  console.log(`[agent-scan-twitter] ⏭️ Skipping ${tweetId} - looks like a bot reply`);
  continue;
}
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/agent-scan-mentions/index.ts` | Add kill switch, add global rate limits |
| `supabase/functions/agent-scan-twitter/index.ts` | Add global rate limits, expand bot blocklist, add reply content filter |

### New Protections Summary

| Layer | Protection | Limit |
|-------|------------|-------|
| 1 | Kill switch (`ENABLE_X_POSTING`) | Must be `true` to post |
| 2 | Bot username blocklist | Skip all bot accounts |
| 3 | Reply content signature filter | Skip tweets containing bot reply text |
| 4 | Per-minute burst limit | Max 20 replies/minute globally |
| 5 | Hourly rate limit | Max 300 replies/hour globally |
| 6 | Deduplication table | No duplicate replies per tweet_id |

---

## Re-enabling Posting (After Fix)

Once the fix is deployed:

1. Set environment variable in backend secrets:
   - Key: `ENABLE_X_POSTING`
   - Value: `true`

2. Monitor the `twitter_bot_replies` table for the first hour
3. Check logs for any unexpected patterns

The system will remain in detection-only mode until the environment variable is explicitly set.

