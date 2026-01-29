

# Fix Token Launch Timeout Issue

## Problem Summary
Token launches are timing out because:
1. **Stale deployment** - The deployed `fun-create` Edge Function still has old background job code (`[fun-create/bg]`), not the synchronous version in the codebase
2. **Redundant operations** - The flow does unnecessary work (job creation, duplicate DB inserts)
3. **Slow Vercel API** - Multiple RPC calls and retries causing delays

## Solution: Streamlined Synchronous Flow

### Architecture
```text
Frontend (TokenLauncher)
    |
    v
Edge Function (fun-create)  
    |
    | [Simple passthrough - NO job creation]
    v
Vercel API (create-fun)
    |
    | [All on-chain + DB work]
    v
Direct Response (success/fail)
```

### Changes Required

#### 1. Simplify Edge Function (`supabase/functions/fun-create/index.ts`)
Remove all job-related complexity. The Edge Function should:
- Validate inputs
- Upload image if base64
- Record rate limit
- Call Vercel API synchronously
- Return Vercel's response directly
- NO job creation, NO separate `fun_tokens` insert (Vercel handles DB)

Key changes:
- Remove `backend_create_token_job` call
- Remove `fun_token_jobs` status updates
- Remove `fun_tokens` insert (redundant - tokens table is the source)
- Pass through Vercel response directly
- Keep rate limiting and image upload

#### 2. Optimize Vercel API (`api/pool/create-fun.ts`)
Already mostly optimized but ensure:
- Pre-fetch blockhash once (already done)
- `skipPreflight: true` (already done)
- Fire-and-forget for non-critical operations (already done)
- Reduce delay between transactions from 300ms to 100ms

#### 3. Update Frontend (`src/components/launchpad/TokenLauncher.tsx`)
Already uses simple synchronous approach. No changes needed - the current code:
- Calls `fun-create` 
- Waits for response
- Shows success/error

#### 4. Deploy Edge Function
Force redeploy to replace the stale background-job version

---

## Technical Details

### Edge Function Simplification

**Current (overcomplicated):**
1. Create job in `fun_token_jobs`
2. Set job to "processing"
3. Call Vercel API
4. Insert to `fun_tokens`
5. Complete job

**New (streamlined):**
1. Validate + upload image
2. Record rate limit
3. Call Vercel API
4. Return Vercel response

### Why This Works
- The Vercel API already creates the token in the `tokens` table via `backend_create_token`
- The `fun_tokens` table is for the "fun launcher" display but can use `tokens` data
- Removing 3 database operations saves ~1-2 seconds
- Direct passthrough eliminates timeout-prone job polling

### Expected Timeline
- Edge Function call: ~2s (validation, image upload, rate limit)
- Vercel API call: ~5-7s (RPC + on-chain transactions)
- Total: ~7-9s (within limits)

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fun-create/index.ts` | Remove job logic, simplify to passthrough |
| `api/pool/create-fun.ts` | Reduce inter-tx delay to 100ms |

