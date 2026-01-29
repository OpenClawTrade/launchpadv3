
# Fix Token Launches - Complete Solution

## Root Cause (What I Found)

After deep investigation, here's exactly why token launches broke:

### The Problem Chain
1. **Edge Function (`fun-create`)** fires a "fire-and-forget" request to Vercel
2. **Edge Function immediately returns** with job ID, starts polling
3. **Vercel API (`/api/pool/create-fun`)** starts on-chain work...
4. **Vercel gets killed after 10 seconds** (Hobby plan limit)
5. **Callback never happens** - Vercel was terminated before it could call `fun-create-callback`
6. **Job stuck in "processing" forever** - frontend polls endlessly with no result

### Evidence
- `fun_token_jobs` table: 2 jobs stuck in "processing" status forever
- `fun-create-callback` logs: **ZERO logs** - callback was never called
- Last successful token: **Jan 26** (3 days ago)
- Vercel execution time needed: 20-40 seconds; Vercel limit: 10 seconds

---

## The Simple Fix

**Stop relying on callbacks. Use synchronous waiting.**

Supabase Edge Functions can run for **60 seconds**. Vercel's 10-second limit doesn't matter if we wait for its response in the Edge Function (even if Vercel times out, we detect it and handle it).

### New Flow

```text
User → Edge Function → Vercel API (fire-and-forget) → On-chain work
         ↓
  Wait up to 50s checking job status directly
         ↓
  Return result immediately to frontend
```

**Why this works**:
1. Edge Function has 60 seconds to complete
2. Vercel's `/api/pool/create-fun` already creates tokens directly in `tokens` table
3. We just need to also create them in `fun_tokens` table within the Edge Function
4. No callback dependency, no polling, fast response

---

## Technical Changes

### 1. Modify Edge Function (`supabase/functions/fun-create/index.ts`)

**Current (broken)**:
```typescript
// Fire-and-forget (returns immediately, relies on callback)
fetch(vercelUrl, {...}).catch(err => console.error(err));
return Response({ async: true, jobId });
```

**Fixed**:
```typescript
// Wait for Vercel to complete (with 50s timeout)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 50000);

try {
  const response = await fetch(vercelUrl, { signal: controller.signal, ... });
  clearTimeout(timeoutId);
  
  const result = await response.json();
  
  if (result.success) {
    // Create fun_tokens record directly in Edge Function
    await supabase.from("fun_tokens").insert({
      name, ticker, creator_wallet, mint_address: result.mintAddress,
      dbc_pool_address: result.dbcPoolAddress, ...
    });
    
    // Mark job completed
    await supabase.rpc("backend_complete_token_job", {...});
    
    return Response({ success: true, mintAddress: result.mintAddress, ... });
  }
} catch (err) {
  if (err.name === 'AbortError') {
    // 50s timeout - Vercel is taking too long
    return Response({ error: "Token creation timed out" });
  }
  throw err;
}
```

### 2. Simplify Frontend (`TokenLauncher.tsx`)

**Current (broken)**:
- Uses `useTokenJobPolling` hook
- Waits 90+ seconds polling every 2s
- Never gets "completed" status

**Fixed**:
- Remove polling entirely
- Wait for single response from Edge Function
- Show loading state for up to 50 seconds
- Display result immediately

```typescript
const { data, error } = await supabase.functions.invoke("fun-create", { body });

if (error) throw error;
if (!data?.success) throw new Error(data?.error);

// Direct result - no polling needed!
onShowResult({
  success: true,
  mintAddress: data.mintAddress,
  solscanUrl: data.solscanUrl,
  ...
});
```

### 3. Clean Up Frontend (`ClaudeLauncherPage.tsx`)

Same changes as TokenLauncher - remove polling, handle direct response.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fun-create/index.ts` | Wait synchronously for Vercel, create `fun_tokens` directly, return result |
| `src/components/launchpad/TokenLauncher.tsx` | Remove polling, handle direct response |
| `src/pages/ClaudeLauncherPage.tsx` | Remove polling, handle direct response |

---

## Expected Result

1. User clicks "Launch" button
2. Loading state shows for ~10-30 seconds (actual on-chain time)
3. Success/failure returned directly
4. No more jobs stuck in "processing"
5. Token appears immediately in the list

---

## Why This Matches What Worked Before

The successful tokens from Jan 26 show that the Vercel API itself works fine and can create tokens. The problem is purely in the async/callback pattern. By making the Edge Function wait synchronously, we:

1. Use Supabase's 60-second limit (plenty of time)
2. Don't depend on Vercel's callback (which never arrives due to 10s timeout)
3. Handle everything in one request-response cycle
4. Give users immediate feedback
