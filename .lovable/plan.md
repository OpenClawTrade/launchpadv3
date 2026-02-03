
# Fix Hourly Post Duplicates - Complete Solution

## Problem Summary
The hourly update system (`agent-hourly-post`) is creating **duplicate posts on X**, risking account suspension. Multiple identical hourly updates are being posted because the deduplication logic is broken.

## Root Cause Analysis

### Evidence from Logs
```
error_message: {"status":"error","message":"could not extract tweet_id from response"}
success: false
tweet_id: null
```

All hourly posts in the last 24 hours show `success: false` - but the tweets **may still be posting to X**!

### The Bug Chain

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Cron triggers at :00                                         │
│ 2. Check: "Any success=true in last 50 min?" → NO (all failed)  │
│ 3. Post tweet to X → Tweet actually posts ✅                    │
│ 4. API returns error parsing response → "could not extract      │
│    tweet_id"                                                    │
│ 5. Logged as success=false                                      │
│ 6. Next hour: Same check → still NO successful posts            │
│ 7. Posts AGAIN → DUPLICATE ON X!                                │
└─────────────────────────────────────────────────────────────────┘
```

### Three Critical Issues

| Issue | Current Code | Problem |
|-------|--------------|---------|
| **Dedup check** | `.eq("success", true)` | Only skips if previous post was "successful" - failed posts don't block next run even if tweet actually went through |
| **No error detection** | Missing `isTwitterApiErrorPayload` | Doesn't detect `{status: "error"}` responses properly |
| **No lock mechanism** | None | No protection against race conditions if cron fires twice |

## Solution

### Fix 1: Change Deduplication Logic
Skip posting if ANY log entry exists in the last 50 minutes (regardless of success status):

```typescript
// BEFORE (buggy):
const { data: recentPost } = await supabase
  .from("hourly_post_log")
  .select("id, posted_at")
  .gte("posted_at", new Date(Date.now() - 50 * 60 * 1000).toISOString())
  .eq("success", true)  // ❌ Only checks successful posts
  .limit(1)
  .single();

// AFTER (safe):
const { data: recentPost } = await supabase
  .from("hourly_post_log")
  .select("id, posted_at, success")
  .gte("posted_at", new Date(Date.now() - 50 * 60 * 1000).toISOString())
  // No .eq("success", true) - check ANY recent attempt
  .order("posted_at", { ascending: false })
  .limit(1)
  .single();

if (recentPost) {
  console.log(`[agent-hourly-post] Skipping - already attempted within 50 minutes (success: ${recentPost.success})`);
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: "Already attempted recently" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Fix 2: Add Error Payload Detection
Add proper error detection before assuming success (copy from working functions):

```typescript
const isTwitterApiErrorPayload = (postData: any): boolean => {
  if (!postData || typeof postData !== "object") return true;
  if (postData.success === false) return true;
  if (postData.status === "error") return true;
  if (typeof postData.error === "string" && postData.error.length > 0) return true;
  if (typeof postData.msg === "string" && postData.msg.toLowerCase().includes("failed")) return true;
  return false;
};
```

### Fix 3: Add Cron Lock (Optional but Recommended)
Use the `cron_locks` table pattern from other functions:

```typescript
// Acquire lock before posting
const lockName = "hourly-post-lock";
const lockExpiry = 120; // 2 minutes

const { data: existingLock } = await supabase
  .from("cron_locks")
  .select("id, expires_at")
  .eq("lock_name", lockName)
  .gt("expires_at", new Date().toISOString())
  .maybeSingle();

if (existingLock) {
  console.log("[agent-hourly-post] Lock held by another instance, skipping");
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: "Lock held" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Upsert lock
await supabase
  .from("cron_locks")
  .upsert({
    lock_name: lockName,
    acquired_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + lockExpiry * 1000).toISOString(),
  }, { onConflict: "lock_name" });
```

## Files to Modify

### `supabase/functions/agent-hourly-post/index.ts`

1. **Add error detection helper** (after line 56)
2. **Update deduplication check** (lines 122-137) - remove `.eq("success", true)`
3. **Add cron lock acquisition** (after dedup check)
4. **Use error detection** before logging result (around line 247)

## Technical Implementation

### Complete Updated Flow

```text
1. Cron triggers
2. Acquire cron lock (or skip if locked)
3. Check for ANY recent attempt in last 50 min (success or fail)
   → If exists, skip
4. Gather stats
5. Build tweet
6. Post to X
7. Check for error payload before assuming success
8. Log result with accurate success status
9. Release lock (auto-expires)
```

## Impact

- **Prevents duplicate tweets** by blocking reruns after ANY attempt (not just successful ones)
- **Accurate error detection** ensures we don't misreport success
- **Cron lock** prevents race conditions from overlapping executions

## Summary

| What | Change |
|------|--------|
| Root cause | Dedup only checked `success=true`, so failed attempts didn't block reruns |
| Primary fix | Remove `.eq("success", true)` from dedup query |
| Secondary fix | Add `isTwitterApiErrorPayload` helper |
| Tertiary fix | Add cron lock for race condition protection |
| File | `supabase/functions/agent-hourly-post/index.ts` |
