
# Fix Rate Limiting for Punch Launch

## Problems Identified

1. **Wrong rate limit window**: `punch-launch` edge function uses a 3-minute window (1 launch per 3 min) instead of the intended 3 launches per 1 hour
2. **Stale records cause false positives**: The rate limit record is inserted BEFORE token creation (line 58), so even if you haven't launched anything, old records from hours ago that weren't cleaned up, or records from failed launches, count against you
3. **429 response not properly handled**: `supabase.functions.invoke()` treats HTTP 429 as an error, meaning `res.data` is null and `res.error` contains the body. The code checks `data?.rateLimited` which is always false since data is null on 429
4. **No pre-check**: The `check-launch-rate` edge function exists but is never called from the Punch pages -- rate limiting only fires at launch time after the user completed 50 taps

## Plan

### 1. Fix `punch-launch` edge function rate limit logic
- Change window from 3 minutes to 1 hour (60 minutes)
- Change limit from 1 to 3 launches per window
- Move the rate limit record insert to AFTER successful token creation (not before)
- This prevents failed/aborted launches from consuming rate limit slots

### 2. Fix 429 response handling in PunchTestPage
- When `supabase.functions.invoke` returns a non-2xx status, the response body goes into `res.error` (as a `FunctionsHttpError`), not `res.data`
- Parse the error response body to extract `rateLimited` and `waitSeconds` fields
- Show the cooldown popup correctly instead of a generic error

### 3. Add pre-check before starting the tap game
- Call `check-launch-rate` when the page loads and after each launch
- If rate limited, show the cooldown popup immediately instead of letting the user tap 50 times first
- Update the `check-launch-rate` function to also use 3 per hour (it already does)

## Technical Details

### Files to modify:
- **`supabase/functions/punch-launch/index.ts`** -- Fix rate limit window (3min -> 1hr), limit (1 -> 3), move record insert after success
- **`src/pages/PunchTestPage.tsx`** -- Fix 429 error parsing, add pre-check on page load
- **`supabase/functions/check-launch-rate/index.ts`** -- Already correct (3/hr), no changes needed

### Edge function changes (`punch-launch/index.ts`):
```text
Before: RATE_LIMIT_WINDOW_MS = 3 * 60 * 1000 (3 min), limit 1
After:  RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 (1 hr), limit 3
```
- Remove the early `insert` of rate limit record (line 58)
- Add the insert AFTER successful token creation (after the fun_tokens insert)

### Frontend changes (`PunchTestPage.tsx`):
- Parse 429 errors: check `res.error` for rate limit data when status is 429
- Add `useEffect` on mount to call `check-launch-rate` and set `rateLimitUntil` if blocked
- Re-check after each successful launch
