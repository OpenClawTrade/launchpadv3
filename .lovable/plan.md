

# Fix Token Launch Timeout - Add Logging and Disable Vanity

## Problem Identified
1. **Vanity pool is EMPTY**: 0 available, 40 reserved, 131 used
2. The "Random Token" tab on Fun Launcher uses the flow:
   - Frontend (`TokenLauncher.tsx`) → Edge Function (`fun-create`) → Vercel API (`api/pool/create-fun.ts`)
3. Even though vanity fallback exists (random mint), the launch is still timing out somewhere in this chain

## Root Cause Hypothesis
The timeout is happening in one of these places:
- Edge Function timing out waiting for Vercel
- Vercel API timing out during RPC calls (blockhash, transaction send)
- Meteora SDK curve calculation taking too long
- Database operations taking too long

## Solution: Add Detailed Logging + Disable Vanity

### Step 1: Add Version and Timing Logs to Edge Function
Add `VERSION` constant and timestamp logs at every step in `supabase/functions/fun-create/index.ts`:
- Log version on entry
- Log time elapsed at each major step (validation, image upload, rate limit, Vercel call, response)
- This will help identify exactly where time is being spent

### Step 2: Add Version and Timing Logs to Vercel API
Add `VERSION` constant and timing logs to `api/pool/create-fun.ts`:
- Log on entry with version
- Log elapsed time after blockhash fetch
- Log when vanity lookup starts/completes (and explicitly log "skipped" when disabled)
- Log after pool creation
- Log after each transaction send
- Log after database operations

### Step 3: Disable Vanity Address Lookup
In `api/pool/create-fun.ts`, change `useVanityAddress = true` default to `false`:
- This will bypass the vanity lookup entirely
- Use random mint address for all launches
- Once stable, vanity can be re-enabled after pool is refilled

### Step 4: Reduce Potential Bottlenecks
- Change the inter-transaction delay from 100ms to 50ms
- Remove the 40 reserved addresses that are stuck (they will never be used)
- These are blocking the pool and may indicate failed launches

### Step 5: Deploy and Test
- Deploy the `fun-create` Edge Function
- Test a token launch
- Check logs to see version confirmation and timing breakdown

---

## Technical Changes

### File: `supabase/functions/fun-create/index.ts`
Add version constant and timing logs:
```typescript
const VERSION = "v1.1.0";
const DEPLOYED_AT = "2026-01-29T18:30:00Z";

// At start of handler:
console.log(`[fun-create][${VERSION}] Request received`, { clientIP, deployed: DEPLOYED_AT });
const startTime = Date.now();

// After each step:
console.log(`[fun-create][${VERSION}] Rate limit check complete`, { elapsed: Date.now() - startTime });
console.log(`[fun-create][${VERSION}] Image upload complete`, { elapsed: Date.now() - startTime });
console.log(`[fun-create][${VERSION}] Calling Vercel API...`, { elapsed: Date.now() - startTime });
console.log(`[fun-create][${VERSION}] Vercel response received`, { elapsed: Date.now() - startTime, success: result.success });
```

### File: `api/pool/create-fun.ts`
1. Add version constant and timing logs
2. Disable vanity by default:
```typescript
const VERSION = "v1.1.0";

// Change default from true to false:
const { useVanityAddress = false } = req.body;

// Add timing logs throughout
```
3. Reduce inter-transaction delay from 100ms to 50ms

### Database: Clean Up Reserved Addresses
SQL to release stuck reserved addresses back to available:
```sql
UPDATE public.vanity_keypairs 
SET status = 'available' 
WHERE status = 'reserved' 
  AND created_at < NOW() - INTERVAL '1 hour';
```

---

## Expected Outcome
- Token launches will use random mint addresses (no vanity lookup delay)
- Detailed logs will show exactly where time is spent
- Version in logs confirms we're running the latest code
- If still failing, logs will pinpoint the bottleneck (RPC? SDK? DB?)

