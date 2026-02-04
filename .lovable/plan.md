
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

### Phase 1 – Database Changes

**Create migration:**
```text
supabase/migrations/XXXX_prevent_duplicate_launches.sql
```

Changes:
- Add a unique constraint on `fun_tokens.mint_address` (if not exists) so duplicates can never slip through.
- Add a new lightweight table `launch_idempotency_locks` for tracking in-flight and completed attempts:

```text
┌──────────────────────────────────────────────────────────────┐
│ launch_idempotency_locks                                     │
├──────────────────────────────────────────────────────────────┤
│ idempotency_key     UUID PK                                  │
│ creator_wallet      TEXT NOT NULL                            │
│ ticker              TEXT NOT NULL (uppercase)                │
│ status              TEXT DEFAULT 'processing' (processing/   │
│                            completed/failed)                 │
│ result_mint_address TEXT NULL                                │
│ result_token_id     UUID NULL                                │
│ created_at          TIMESTAMPTZ DEFAULT now()                │
│ completed_at        TIMESTAMPTZ NULL                         │
│                                                              │
│ UNIQUE (creator_wallet, ticker)                              │
│     WHERE status = 'processing'                              │
│     OR (status = 'completed' AND                             │
│         created_at > now() - interval '10 minutes')          │
└──────────────────────────────────────────────────────────────┘
```

An alternative simpler approach using a partial unique index:
```sql
CREATE UNIQUE INDEX idx_prevent_dup_launch
  ON launch_idempotency_locks (lower(ticker), creator_wallet)
  WHERE status IN ('processing', 'completed')
    AND created_at > now() - interval '10 minutes';
```

This index ensures:
- Only one `processing` record can exist per ticker+wallet
- A recent `completed` record also blocks new attempts (10-minute cooldown)
- Older records naturally fall out of the index scope

Add cleanup function to remove stale locks older than 1 hour.

### Phase 2 – Backend RPC Functions

Create two new RPC functions (SECURITY DEFINER, backend-only):

1. **`backend_acquire_launch_lock`**
   - Parameters: `p_idempotency_key`, `p_creator_wallet`, `p_ticker`
   - Logic:
     - Try `INSERT INTO launch_idempotency_locks ...`
     - If it succeeds, return `{ acquired: true, existing: null }`
     - If unique violation, fetch the existing row:
       - If `status = 'completed'`, return existing result (mint address, token id)
       - If `status = 'processing'`, return `{ acquired: false, reason: 'in_progress' }`
   - This makes the lock acquisition atomic.

2. **`backend_complete_launch_lock`**
   - Parameters: `p_idempotency_key`, `p_mint_address`, `p_token_id`, `p_success`
   - Updates the lock record to `completed` or `failed` with results.

### Phase 3 – Edge Function Changes

**File: `supabase/functions/fun-create/index.ts`**

1. Accept optional `idempotencyKey` in the request body.
2. Before calling the Vercel pool creation API:
   ```typescript
   // Acquire lock
   const { data: lock } = await supabase.rpc('backend_acquire_launch_lock', {
     p_idempotency_key: idempotencyKey || crypto.randomUUID(),
     p_creator_wallet: creatorWallet,
     p_ticker: ticker.toUpperCase(),
   });

   if (!lock.acquired) {
     if (lock.existing) {
       // Return the already-completed result
       return new Response(JSON.stringify({
         success: true,
         tokenId: lock.existing.result_token_id,
         mintAddress: lock.existing.result_mint_address,
         message: 'Token already created',
       }), ...);
     }
     // Still in progress
     return new Response(JSON.stringify({
       success: false,
       error: 'A launch for this ticker is already in progress. Please wait.',
       inProgress: true,
     }), { status: 409, ... });
   }
   ```
3. After successful creation (when inserting into `fun_tokens`):
   ```typescript
   await supabase.rpc('backend_complete_launch_lock', {
     p_idempotency_key: idempotencyKey,
     p_mint_address: mintAddress,
     p_token_id: funTokenId,
     p_success: true,
   });
   ```
4. On failure, mark the lock as `failed` so the user can retry.

### Phase 4 – Frontend Changes

**File: `src/components/launchpad/TokenLauncher.tsx`**

1. Generate a stable idempotency key once per form session:
   ```typescript
   const [idempotencyKey] = useState(() => crypto.randomUUID());

   // Reset on successful launch or when ticker changes significantly
   ```
2. Pass `idempotencyKey` in the request body to `fun-create`.
3. On 409 "in progress" response, show a toast: "This token is already being created. Please wait."
4. Increase the timeout from 35s to 60s (on-chain confirmation can take longer under load).
5. If the on-chain request times out but returns with `inProgress: true`, poll the status instead of showing an error.

**File: `src/pages/ClaudeLauncherPage.tsx`**

Apply the same idempotency key pattern.

### Phase 5 – Additional Safety

1. **Unique constraint on `fun_tokens.mint_address`** – As a last line of defense, add:
   ```sql
   ALTER TABLE fun_tokens ADD CONSTRAINT fun_tokens_mint_address_unique UNIQUE (mint_address);
   ```
   This prevents the edge case where the lock fails but the insert still somehow happens.

2. **Cleanup cron** – Periodic function to delete `launch_idempotency_locks` records older than 1 hour to keep the table lean.

---

## Technical Details

### Lock Acquisition Flow

```text
Frontend           Edge Function           Database
   │                     │                     │
   ├─ POST fun-create ──►│                     │
   │  (idempotencyKey)   │                     │
   │                     ├─ acquire_lock ─────►│
   │                     │                     │◄─ INSERT ... ON CONFLICT
   │                     │◄───── result ───────┤
   │                     │                     │
   │  [if acquired]      │                     │
   │                     ├─ create pool ──────►│ (Vercel API)
   │                     │                     │
   │                     ├─ complete_lock ────►│
   │◄─── success ────────┤                     │
```

### Cooldown Enforcement

The partial unique index on `(ticker, creator_wallet)` with condition `created_at > now() - 10 min` means:
- While a lock is `processing`, no new lock can be created
- After `completed`, no new lock for the same ticker+wallet can be created for 10 minutes
- After 10 minutes, the user can intentionally launch the same ticker again

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/XXXX_prevent_duplicate_launches.sql` | Create table, index, RPC functions, constraint |
| `supabase/functions/fun-create/index.ts` | Add idempotency key handling |
| `src/components/launchpad/TokenLauncher.tsx` | Generate and send idempotency key, handle 409 |
| `src/pages/ClaudeLauncherPage.tsx` | Same idempotency key pattern |
| `src/hooks/useTokenJobPolling.ts` | (Optional) Extend polling for idempotent retry |

---

## Expected Outcome

- Double-clicks or timeout retries return the same result instead of creating duplicates
- Same ticker+wallet blocked for 10 minutes after a successful launch
- On-chain funds protected from accidental duplicate deployments
- Clear user feedback when a launch is in progress
