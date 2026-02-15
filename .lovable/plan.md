
# Update Launch Rate Limit: 5 per IP per 24 Hours

## Current State
Rate limiting is enforced independently in 4 edge functions, each hardcoded to **2 launches per 1 hour**:

- `check-launch-rate/index.ts` (frontend pre-check)
- `fun-create/index.ts` (fun token creation)
- `launchpad-create/index.ts` (legacy launchpad creation)
- `claw-trading-create/index.ts` (Claw mode -- currently has NO rate limiting)

They all query the same `launch_rate_limits` table by IP address.

## Changes

### 1. Update constants in all 4 edge functions

Change the rate limit constants from `2 per hour` to `5 per 24 hours`:

```
MAX_LAUNCHES = 2  -->  5
WINDOW = 1 hour   -->  24 hours
```

**Files:**
- `supabase/functions/check-launch-rate/index.ts` -- update constants + message text
- `supabase/functions/fun-create/index.ts` -- update constants + message text
- `supabase/functions/launchpad-create/index.ts` -- update constants + message text

### 2. Add rate limiting to `claw-trading-create/index.ts`

This function currently has no rate limit check. Add the same IP-based rate limit (5 per 24h) with an insert into `launch_rate_limits` on success, matching the pattern from the other functions.

### 3. Update the frontend hook

- `src/hooks/useLaunchRateLimit.ts` -- update default `maxLaunches` from 2 to 5 and adjust the message/countdown display to reference "24 hours" instead of "60 minutes"

### 4. Update the `api-launch-token` edge function

This is the API-based launch endpoint. It doesn't currently have IP-based rate limiting (it uses API key auth), but to be consistent with "all modes," add the same 5 per 24h IP-based check here too.

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/check-launch-rate/index.ts` | `MAX_LAUNCHES_PER_HOUR` -> `MAX_LAUNCHES_PER_DAY = 5`, `RATE_LIMIT_WINDOW_MS` -> 24h, update message text |
| `supabase/functions/fun-create/index.ts` | Same constant changes (lines 73-74), update error message |
| `supabase/functions/launchpad-create/index.ts` | Same constant changes (lines 101-102), update error message |
| `supabase/functions/claw-trading-create/index.ts` | Add IP extraction + rate limit check block + insert on success |
| `supabase/functions/api-launch-token/index.ts` | Add IP-based rate limit check + insert on success |
| `src/hooks/useLaunchRateLimit.ts` | Update `maxLaunches` default from 2 to 5 |

No database schema changes needed -- the existing `launch_rate_limits` table and cleanup function (which already retains records for 24 hours) support this directly.
