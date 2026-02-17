

# Fix Vanity Address System: TNA -> TUNA Migration

## Issues Found

### 1. No cron job exists
The `vanity-cron` edge function has **no pg_cron schedule** set up. There is no cron job in `cron.job` table. The function only runs when manually triggered from the admin page. That's why it never auto-runs to reach 500.

### 2. Suffix mismatch: multiple places still use 'TNA' instead of 'TUNA'
The edge function correctly generates `tuna` suffix, but **6 files** still request `tna` when reserving vanity addresses:

| File | Line | Current | Fix |
|------|------|---------|-----|
| `api/pool/create-fun.ts` | 389 | `getAvailableVanityAddress('TNA')` | Change to `'tuna'` |
| `api/pool/create-phantom.ts` | 152 | `getAvailableVanityAddress('TNA')` | Change to `'tuna'` |
| `supabase/functions/bags-agent-launch/index.ts` | 43 | `p_suffix: 'tna'` | Change to `'tuna'` |
| `supabase/functions/pump-agent-launch/index.ts` | 41 | `p_suffix: 'tna'` | Change to `'tuna'` |
| `api/vanity/progress.ts` | 42 | default suffix `'TNA'` | Change to `'tuna'` |
| Comments in multiple files | various | "TNA suffix" | Update to "TUNA suffix" |

### 3. Database state confirms the problem
- `tna` suffix: 45 available, 199 reserved, 116 used
- `tuna` suffix: only 3 available (from recent manual runs)

The generator is producing `tuna` addresses but all consumers are requesting `tna`, so the new addresses never get used.

### 4. Case-insensitive matching is already correct
The `vanity-cron` edge function correctly uses `CASE_SENSITIVE = false` and stores suffix as `tuna` (lowercase). The `matchesSuffix` function does `.toLowerCase()` comparison. This means any case combo (TUNA, tuna, TuNa) will match -- this is correct.

## Plan

### Step 1: Set up pg_cron job for auto-generation
Create a cron job to invoke `vanity-cron` every minute so it auto-fills to 500:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'vanity-cron-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/vanity-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44"}'::jsonb,
    body:='{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);
```

### Step 2: Update all consumers from 'TNA' to 'tuna'

**`api/pool/create-fun.ts`** (line 389):
- `getAvailableVanityAddress('TNA')` -> `getAvailableVanityAddress('tuna')`

**`api/pool/create-phantom.ts`** (line 152):
- `getAvailableVanityAddress('TNA')` -> `getAvailableVanityAddress('tuna')`

**`supabase/functions/bags-agent-launch/index.ts`** (line 43):
- `p_suffix: 'tna'` -> `p_suffix: 'tuna'`

**`supabase/functions/pump-agent-launch/index.ts`** (line 41):
- `p_suffix: 'tna'` -> `p_suffix: 'tuna'`

**`api/vanity/progress.ts`** (line 42):
- Default suffix `'TNA'` -> `'tuna'`

Update all comments referencing "TNA suffix" to "TUNA suffix" in these files.

### Step 3: Redeploy edge functions
- `bags-agent-launch`
- `pump-agent-launch`

(The `api/` files are Vercel serverless functions and deploy automatically on push.)

### Summary
After these changes:
- The cron job auto-invokes `vanity-cron` every minute, generating case-insensitive TUNA addresses until 500 are available
- All launch functions correctly request `tuna` suffix addresses from the pool
- Addresses display as "TUNA" across the site regardless of actual base58 casing
