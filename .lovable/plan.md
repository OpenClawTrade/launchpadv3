
# Fix Token Launches - Complete Diagnosis and Solution

## Root Cause Analysis

After thorough investigation, here's exactly what's happening:

### The Problem Chain
1. **Edge Function (`fun-create`)** has a 15-second timeout waiting for Vercel
2. **Vercel API (`/api/pool/create-fun`)** takes 15-30+ seconds for on-chain work:
   - RPC calls for blockhash (can hit 429 rate limits)
   - Multiple transaction signing and sending
   - Database inserts
3. **Vercel Hobby plan kills the function at 10 seconds** - before it can respond
4. **Edge Function's 15s timeout expires** - showing 504 Gateway Timeout
5. **User sees nothing for 15+ seconds then an error**

### Evidence from Logs
- `fun_token_jobs` table shows jobs failing with "Token creation timed out after 50 seconds" and "On-chain creation timed out (55s)"
- Jobs stuck in "processing" status forever
- Edge function logs show rate limit hits: "❌ Rate limit exceeded for IP"
- RPC logs show "429 max usage reached" errors throughout the system

### Current Architecture Flaw
```text
Frontend ─→ Edge Function (60s limit) ─→ Vercel (10s limit) ─→ Solana RPC
                    ↑
           Waits 15s for Vercel
                    ↓
             Vercel dies at 10s
                    ↓
           Edge function times out
                    ↓
             User sees 504 error
```

---

## The Fix: Return Before Vercel Times Out

Since Vercel Hobby has a hard 10-second limit, we must ensure it returns BEFORE that. The on-chain transactions can still complete after Vercel responds.

### New Architecture
```text
Frontend ─→ Edge Function ─→ Vercel API
     ↑                           │
     │                           ├─→ Send transactions (fire-and-forget)
     │                           └─→ Return immediately with txSignatures
     │                                        ↓
     └─────── Response in ~5-8 seconds ─────────
```

### Key Changes

**1. Vercel API (`api/pool/create-fun.ts`)**
- Already optimized to skip confirmation (`skipPreflight: true`)
- BUT still doing too much before responding
- Remove or reduce RPC calls that cause delays
- Return response immediately after sending transactions

**2. Edge Function (`fun-create`)**
- Reduce timeout from 15s to 10s (match Vercel limit)
- Add better error messages for timeout
- Ensure proper job status updates

**3. RPC Rate Limiting**
- The 429 "max usage reached" errors are causing RPC calls to retry/fail
- Add exponential backoff for blockhash retrieval
- Consider parallel RPC endpoints

---

## Technical Implementation

### Phase 1: Fix Vercel API Timing

The Vercel API currently does:
1. Get treasury keypair (~0s)
2. Get vanity address (~1-2s network)
3. Create Meteora pool transactions (~1-2s)
4. Get blockhash for each tx (~1-2s each, can hit 429)
5. Sign each transaction (~0s)
6. Send each transaction (~2-3s each)
7. Database inserts (~1-2s)
8. Sniper buy (fire-and-forget)
9. Return response

**Total: 10-20+ seconds**

To fix, we need to:
- Move database inserts AFTER returning response (fire-and-forget)
- Use a single blockhash for all transactions
- Pre-fetch blockhash before signing loop
- Ensure response returns within 8 seconds

### Phase 2: Edge Function Alignment

Update `fun-create` to:
- Use 10-second timeout (not 15s or 50s)
- Provide clear error if timeout occurs
- Create `fun_tokens` record AFTER Vercel confirms success

### Phase 3: Frontend UX

The UI currently:
- Calls Edge Function
- Waits for response (up to 30+ seconds)
- Shows nothing during wait

To fix:
- Show progress UI immediately ("Creating token...")
- Handle 10-second timeout gracefully
- Display success/failure clearly

---

## Files to Modify

| File | Changes |
|------|---------|
| `api/pool/create-fun.ts` | Pre-fetch blockhash once, reduce total execution time to < 8s |
| `supabase/functions/fun-create/index.ts` | Reduce timeout to 10s, improve error handling |
| `src/components/launchpad/TokenLauncher.tsx` | Better loading state, handle timeouts gracefully |

---

## Expected Outcome

1. User clicks "Launch"
2. Loading state shows immediately
3. Response returns in ~5-10 seconds
4. Success message with Solscan link
5. Token appears in list

If timeout occurs:
- Clear error message: "Token creation took too long. Please try again."
- Job marked as failed in database (not stuck in "processing")

---

## Additional Fixes

### CORS Error on `sol-price`
The logs show CORS errors on `sol-price` endpoint. The function looks correct but may need redeployment.

### RPC Rate Limiting
Multiple functions show "429 max usage reached":
- `fun-distribute`
- `fun-claim-fees`
- `sol-price`

These are separate from the launch issue but indicate overall RPC congestion. The paid Helius tier should handle this, but we may need to:
- Reduce polling frequency
- Add better caching
- Stagger concurrent requests

---

## Implementation Order

1. **Fix Vercel API timing** - Make it return in < 8 seconds
2. **Update Edge Function timeout** - Align to 10 seconds
3. **Redeploy both** - Vercel API + Edge Function
4. **Test** - Verify launches complete successfully
5. **Fix CORS** - Redeploy `sol-price` if needed
