

# Update Rate Limit to 3 Launches Per Hour

## Changes

### 1. Edge Function (`supabase/functions/check-launch-rate/index.ts`)
- Change `MAX_LAUNCHES_PER_HOUR` from `2` to `3` on line 13

### 2. Frontend Hook (`src/hooks/useLaunchRateLimit.ts`)
- Change default `maxLaunches` from `2` to `3` (line 20)
- Change default `remaining` from `2` to `3` (line 21)

Both changes are single-line constant updates. No other files need modification.

