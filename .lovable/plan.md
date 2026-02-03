

# Increase Agent Launch Rate Limit from 3 to 10

## Summary

Update the daily agent launch limit per X account from **3** to **10** launches per 24 hours. This involves changing hardcoded values in two edge functions and all associated error messages.

---

## Changes Required

### 1. `supabase/functions/agent-scan-twitter/index.ts`

This is the primary rate limit check that runs when scanning Twitter for `!tunalaunch` tweets.

| Line | Current | New |
|------|---------|-----|
| 827 | `const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 3;` | `const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 10;` |
| 1139 | `error_message: "Daily limit of 3 Agent launches..."` | `error_message: "Daily limit of 10 Agent launches..."` |
| 1147 | Reply text: `"...daily limit of 3 Agent launches..."` | Reply text: `"...daily limit of 10 Agent launches..."` |

---

### 2. `supabase/functions/agent-process-post/index.ts`

This is the secondary (defensive) rate limit check that runs during the actual token launch process.

| Line | Current | New |
|------|---------|-----|
| 436 | `const DAILY_LAUNCH_LIMIT = 3;` | `const DAILY_LAUNCH_LIMIT = 10;` |
| 625 | `throw new Error("Daily limit of 3 Agent launches...")` | `throw new Error("Daily limit of 10 Agent launches...")` |

---

## Technical Details

**Rate Limit Logic:**
- The system counts completed launches per `post_author_id` (X user ID) within the last 24 hours
- Both edge functions use the same counting mechanism via the `agent_social_posts` table
- The `agent-scan-twitter` function is the primary check (prevents processing)
- The `agent-process-post` function is a secondary check (defensive layer)

**After Deployment:**
- New limit takes effect immediately
- Users who were previously rate-limited can launch more tokens
- The reply message to rate-limited users will reflect the new "10" limit

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/agent-scan-twitter/index.ts` | Update constant + 2 error messages (lines 827, 1139, 1147) |
| `supabase/functions/agent-process-post/index.ts` | Update constant + 1 error message (lines 436, 625) |

