

## Fix: Set Per-User Launch Limit to 3 Per Day + Add Limit to Backup Scanner

The rate-limiting infrastructure already exists in `agent-scan-twitter` but is configured to 10 launches per day. The backup scanner (`agent-scan-mentions`) has no per-user limit at all.

### Changes

#### 1. `supabase/functions/agent-scan-twitter/index.ts`

| Line | Current | New |
|------|---------|-----|
| 814 | `DAILY_LAUNCH_LIMIT_PER_AUTHOR = 10` | `DAILY_LAUNCH_LIMIT_PER_AUTHOR = 3` |
| 1254 | `"Daily limit of 10 Agent launches"` | `"Daily limit of 3 Agent launches"` |
| 1262 | Reply text says "daily limit of 10" | Reply text says "daily limit of 3" |

#### 2. `supabase/functions/agent-scan-mentions/index.ts`

Add the same per-author rate limit check that `agent-scan-twitter` has, before calling `agent-process-post`:

- Add `getAuthorLaunchesToday()` helper function (same as in `agent-scan-twitter`)
- Before processing each mention, count completed launches by that `authorId` in the last 24 hours
- If count >= 3, skip processing and reply with the rate limit message
- Record the attempt as `status: "failed"` with error `"Daily limit of 3 Agent launches per X account reached"`

#### 3. `supabase/functions/agent-process-post/index.ts`

Update the secondary safety check constant:

| Line | Current | New |
|------|---------|-----|
| 733 | `DAILY_LAUNCH_LIMIT = 10` | `DAILY_LAUNCH_LIMIT = 3` |

### Reply Message (when limit hit)

```
Hey @username! You've reached the daily limit of 3 launches per X account.

Please try again tomorrow!
```

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/agent-scan-twitter/index.ts` | Change constant from 10 to 3, update reply text |
| `supabase/functions/agent-scan-mentions/index.ts` | Add per-author daily limit check with reply |
| `supabase/functions/agent-process-post/index.ts` | Change secondary limit constant from 10 to 3 |

All three edge functions will be redeployed after changes.

