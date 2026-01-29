
# Plan: Fix Token Launches (Restore Fast Async Flow)

## Problem Diagnosis

The token launch system broke because the implementation was changed from an **async fire-and-forget pattern** to a **synchronous wait pattern**. Here's what's happening:

1. **Current broken flow**: The Edge Function (`fun-create`) waits up to 55 seconds for the Vercel API to complete
2. **Vercel Hobby plan has a 10-second timeout** - the on-chain operations (creating pool, signing transactions, confirmations) take longer than 10 seconds
3. **Result**: Vercel times out with `FUNCTION_INVOCATION_TIMEOUT`, the Edge Function eventually times out too, and no token gets created

The previous working implementation (visible in logs from Jan 26) used a true async pattern where the Edge Function returned immediately and the frontend polled for completion.

---

## Solution Overview

Restore the **fire-and-forget async pattern**:

```text
+----------------+     +----------------+     +----------------+
|   Frontend     |     |  Edge Function |     |   Vercel API   |
| (TokenLauncher)|     |  (fun-create)  |     | (create-fun)   |
+-------+--------+     +-------+--------+     +-------+--------+
        |                      |                      |
   1. Launch Request --------> |                      |
        |                      |                      |
        |          2. Create job in DB                |
        |          3. Fire-and-forget call ---------> |
        |              (NO AWAIT)                     |
        |                      |                      |
   4. Return jobId <---------- |                      |
        |                      |                      |
   5. Start polling            |        6. On-chain work...
   fun-create-status           |              (takes 20-40s)
        |                      |                      |
        |                      |        7. Callback to Edge
        |                      | <--- fun-create-callback
        |                      |                      |
   8. Poll returns "completed" |                      |
        |                      |                      |
   9. Show success UI          |                      |
        +                      +                      +
```

---

## Technical Changes

### 1. Modify Edge Function (`supabase/functions/fun-create/index.ts`)

**Current (broken)**:
- Waits synchronously for Vercel API with 55s timeout
- Vercel times out at 10s, everything fails

**Fix**:
- Remove the synchronous wait
- Use true fire-and-forget (fetch without awaiting)
- Return job ID immediately to frontend
- Let Vercel API call the callback when done

```typescript
// REMOVE: const vercelResponse = await fetch(...) with 55s timeout

// REPLACE WITH:
// Fire-and-forget - don't await
fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jobId,
    name, ticker, description, imageUrl, websiteUrl, twitterUrl,
    serverSideSign: true,
    feeRecipientWallet: creatorWallet,
    callbackUrl: `${supabaseUrl}/functions/v1/fun-create-callback`,
  }),
}).catch(err => console.error("[fun-create] Fire-and-forget failed:", err));

// Return immediately with job ID
return new Response(JSON.stringify({
  success: true,
  async: true,
  jobId,
  message: "Token creation started...",
}), { ... });
```

### 2. Update Frontend (`src/components/launchpad/TokenLauncher.tsx`)

**Current (broken)**:
- Waits for a single response from fun-create
- Shows 60-second loading toast

**Fix**:
- Detect async response (`data.async && data.jobId`)
- Start polling `fun-create-status` endpoint
- Show progress updates during polling
- Handle completed/failed states

```typescript
const { data, error } = await supabase.functions.invoke("fun-create", { ... });

if (data?.async && data?.jobId) {
  // Start polling for completion
  const result = await pollForCompletion(data.jobId);
  onShowResult(result);
} else if (data?.success) {
  // Synchronous success (shouldn't happen but handle it)
  onShowResult({ ...data });
}
```

### 3. Fix Polling Hook (`src/hooks/useTokenJobPolling.ts`)

The hook already exists but needs to be integrated properly:
- Import and use in TokenLauncher
- Set reasonable polling interval (2 seconds)
- Max attempts (60 = 2 minutes timeout)
- Show progress toasts during polling

### 4. Update ClaudeLauncherPage

Apply the same async polling pattern as TokenLauncher.

### 5. Verify Callback Function (`fun-create-callback`)

The callback function already exists and handles:
- Receiving completion data from Vercel
- Inserting into `fun_tokens` table
- Marking job as completed

No changes needed here - it's already set up correctly.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fun-create/index.ts` | Remove sync wait, add fire-and-forget, return job ID immediately |
| `src/components/launchpad/TokenLauncher.tsx` | Add polling for async launches |
| `src/pages/ClaudeLauncherPage.tsx` | Add polling for async launches |
| `src/hooks/useTokenJobPolling.ts` | Already exists, just needs integration |

---

## Expected Outcome

1. User clicks "Launch" 
2. Edge Function returns in ~1-2 seconds with job ID
3. Frontend shows "Creating token..." and polls every 2 seconds
4. Vercel API completes on-chain work (10-40 seconds)
5. Vercel calls callback, job marked complete
6. Frontend poll detects completion
7. Success UI displayed

**Total perceived time**: Same as before (~10-40 seconds), but no timeouts!

---

## Why This Will Work

1. **Edge Function returns fast** (1-2 seconds) - no timeout risk
2. **Vercel API has time to complete** - even if it takes 30+ seconds, it's not blocking anything
3. **Callback persists results** - even if user closes browser, token is created
4. **Frontend polling is resilient** - can detect success whenever it happens
