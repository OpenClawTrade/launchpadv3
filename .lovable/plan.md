
# Fix Token Launch - Root Cause & Solution

## Problem Diagnosis

After investigating, I found the real issue:

### The Bug Chain
1. **Edge Function (`fun-create`)** fires an async request to Vercel and returns immediately ✅
2. **Vercel API (`/api/pool/create-fun`)** receives the request and starts on-chain work
3. **Vercel times out after 10 seconds** (Hobby plan limit) - the function is killed
4. **Callback never happens** - the on-chain transaction might succeed but we never know
5. **Job stays stuck in "processing" forever** - frontend polls endlessly with no result

### Evidence
- Jobs in DB: `status = 'processing'`, `completed_at = null`
- Edge function logs show: `"Firing async call to Vercel API..."` but no callback received
- `fun-create-callback` logs show no incoming calls from the test job
- Last successful token: **Jan 26** (3 days ago)

---

## Why It Worked Before (Jan 26)

Looking at the working tokens from Jan 26, they were created with the same pattern. Two possibilities:

1. **Vercel's execution was faster** - perhaps fewer transactions or RPC was faster
2. **Different code path** - the synchronous flow was used previously

The key insight: **Vercel Hobby plan cannot reliably complete on-chain operations in 10 seconds**.

---

## Solution Options

### Option A: Hybrid Wait + Polling (Recommended)
Edge Function waits up to 50 seconds for Vercel to complete. If Vercel times out, it still calls back with success/failure via fire-and-forget at the end. This works because:
- Supabase Edge Functions can run for 60 seconds
- Even if Vercel times out, Supabase can detect this and mark job as failed
- Frontend polls for actual status

**Changes:**
1. Edge Function waits for Vercel response (with 50s timeout)
2. If timeout, mark job as failed with clear message
3. If success, return immediately with result

### Option B: Background Queue (Correct Solution)
Use a proper background job system:
- Vercel cron job to process pending jobs
- Or use Supabase cron to retry pending jobs
- Or use a worker service (Inngest, Trigger.dev)

This is architecturally correct but requires more setup.

### Option C: Move On-Chain Work to Edge Function
Port the Meteora SDK to Deno and run entirely in Edge Functions (60-second limit). 
- Complex due to SDK compatibility issues
- Would eliminate Vercel timeout problem

---

## Recommended Fix (Option A)

Make the Edge Function wait synchronously for Vercel, but handle the timeout gracefully:

### Changes Required

**1. Modify `supabase/functions/fun-create/index.ts`**
- Wait for Vercel API response (don't fire-and-forget)
- Use 50-second timeout (leaving 10s buffer for Edge Function)
- On success, update job and return result immediately
- On timeout, mark job as failed with helpful message

**2. Frontend (`TokenLauncher.tsx`, `ClaudeLauncherPage.tsx`)**
- Remove polling complexity
- Show "Creating token..." while waiting
- Handle timeout error gracefully (suggest retry)

**3. Handle Vercel 502 Timeout**
Even with fire-and-forget, if Vercel completes the on-chain work, it should still try to callback. Add error handling for when Vercel times out but transaction might have succeeded.

---

## Technical Implementation

```typescript
// supabase/functions/fun-create/index.ts

// Instead of fire-and-forget, wait synchronously with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s

try {
  const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  
  if (!vercelResponse.ok) {
    // Vercel returned error (possibly 502 timeout)
    const errorText = await vercelResponse.text();
    throw new Error(`Vercel error (${vercelResponse.status}): ${errorText}`);
  }
  
  const result = await vercelResponse.json();
  
  // Success! Update job and return
  await supabase.rpc("backend_complete_token_job", { ... });
  
  return new Response(JSON.stringify({
    success: true,
    async: false, // No polling needed
    ...result
  }), { ... });
  
} catch (error) {
  clearTimeout(timeoutId);
  
  if (error.name === 'AbortError') {
    // Our 50s timeout hit - Vercel is likely still processing or timed out
    await supabase.rpc("backend_fail_token_job", {
      p_job_id: jobId,
      p_error_message: "On-chain creation timed out. The transaction may have succeeded - check Solscan.",
    });
    throw new Error("Token creation timed out. Please check your wallet and try again if no token appears.");
  }
  
  throw error;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fun-create/index.ts` | Wait synchronously for Vercel with 50s timeout, return direct result |
| `src/components/launchpad/TokenLauncher.tsx` | Remove polling, handle direct response |
| `src/pages/ClaudeLauncherPage.tsx` | Same as TokenLauncher |

---

## Expected Outcome

1. User clicks Launch
2. Edge Function waits for Vercel (up to 50 seconds)
3. If Vercel completes in time → Return success immediately
4. If Vercel times out → Return helpful error asking to retry
5. No more jobs stuck in "processing" forever

---

## Long-term Fix

Upgrade Vercel to Pro plan for 60-second timeout, OR move to a proper background job system (Inngest, Trigger.dev, Supabase cron).
