
# Prevent Duplicate Token Launches – Implementation Plan

## Problem Analysis

Two $WARP tokens were created on-chain and saved to the database 6 seconds apart from the **Token Launcher UI** flow:

| Token | Created At | Mint Address |
|-------|------------|--------------|
| Warp #1 | 04:30:20 | BmWiYBWY57p7i1Cw97HXvCYNz5vfoU4CiBBynPEVxXjp |
| Warp #2 | 04:30:26 | RukXn7hY3CAD6VjSt3G4gFoy8aAAHPHMr1YFct6LHfs |

### Root Causes Identified

1. **No client-side idempotency key** – Each launch generates a brand-new mint on-chain; there is no way to link two requests as belonging to the same "launch intent."

2. **Frontend timeout triggers false failure** – The 35-second timeout in `TokenLauncher.tsx` can fire before the on-chain confirmation completes. The user sees an error and clicks Launch again while the first is still processing.

3. **No backend pre-launch lock** – The backend only checks for duplicate `mint_address` *after* on-chain creation, which cannot catch two parallel attempts.

4. **Missing unique constraints** – The `fun_tokens` table lacks any constraint on `mint_address` or a short-lived cooldown key.

---

## Solution: Idempotency Key + Ticker-Wallet Cooldown

Implement a two-layer approach per the user's preferences:

| Layer | Description |
|-------|-------------|
| **Idempotency key** | Client generates a UUID once per launch attempt; if the same key arrives twice the backend reuses the in-progress/completed result |
| **Ticker-wallet cooldown** | Block launching the same ticker from the same wallet within 10 minutes as an extra safety net |

---

## Implementation Steps

### Phase 1 – Database Changes ✅ COMPLETED

**Created migration with:**
- New `launch_idempotency_locks` table for tracking in-flight and completed attempts
- Partial unique index `idx_prevent_dup_processing` on `(lower(ticker), creator_wallet)` for processing status
- Unique constraint on `fun_tokens.mint_address` as last line of defense
- RLS enabled (backend-only access via SECURITY DEFINER functions)

### Phase 2 – Backend RPC Functions ✅ COMPLETED

Created two RPC functions:

1. **`backend_acquire_launch_lock`**
   - Atomically acquires a lock or returns existing result
   - Handles: in_progress, already_completed, cooldown, and new lock scenarios

2. **`backend_complete_launch_lock`**
   - Marks lock as completed/failed with results

3. **`cleanup_old_launch_locks`**
   - Deletes stale locks older than 1 hour

### Phase 3 – Edge Function Changes ✅ COMPLETED

**Updated `supabase/functions/fun-create/index.ts`:**
- Accepts optional `idempotencyKey` in request body
- Acquires lock before calling Vercel pool creation API
- Returns existing result for duplicate requests
- Returns 409 for in-progress requests
- Returns cooldown info for recently completed launches
- Marks lock as completed/failed on finish

### Phase 4 – Frontend Changes ✅ COMPLETED

**Updated `src/components/launchpad/TokenLauncher.tsx`:**
- Generates stable idempotency key via `useState(() => crypto.randomUUID())`
- Passes `idempotencyKey` in request body
- Handles 409 "in progress" response with user-friendly toast
- Increased timeout from 35s to 60s
- Regenerates idempotency key on successful launch

**Updated `src/pages/ClaudeLauncherPage.tsx`:**
- Same idempotency key pattern applied

---

## Expected Outcome

- ✅ Double-clicks or timeout retries return the same result instead of creating duplicates
- ✅ Same ticker+wallet blocked for 10 minutes after a successful launch
- ✅ On-chain funds protected from accidental duplicate deployments
- ✅ Clear user feedback when a launch is in progress
