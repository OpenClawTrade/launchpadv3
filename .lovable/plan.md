

# Fix Token Launch Timeout - Status Update

## Current Status: DEBUGGING

### Issue Identified
- 504 Gateway Timeout with CORS error when launching tokens
- The Edge Function logs show v1.2.0 deployed and working
- Rate limits have been cleared
- The 18:02:33 request didn't generate any logs (possible crash before handler runs)

### Changes Made (v1.2.0)
1. **Edge Function (`supabase/functions/fun-create/index.ts`)**
   - Added VERSION constant for tracking deployments
   - Added detailed timing logs at every step
   - Explicitly disabled vanity addresses (useVanityAddress: false)

2. **Vercel API (`api/pool/create-fun.ts`)**
   - Added VERSION constant for tracking deployments
   - Added detailed timing logs throughout
   - Disabled vanity addresses by default (useVanityAddress = false)
   - Reduced inter-transaction delay from 100ms to 50ms

3. **Database Cleanup**
   - Released 40 stuck "reserved" vanity addresses back to "available"
   - Cleared rate limits for testing IP

### Next Steps to Debug
1. Force redeploy Edge Function
2. Test again without large base64 image (image upload takes time)
3. Check Vercel API logs for bottleneck
4. Consider adding timeout to Vercel fetch call

### Root Cause Hypothesis
The Vercel API at `https://trenchespost.vercel.app/api/pool/create-fun` is taking >10 seconds, causing the Edge Function to timeout. The timeout happens during:
- Blockhash fetch (RPC congestion - 429 errors seen in other functions)
- Meteora SDK pool creation
- Transaction submission

### Potential Solutions
1. **Increase Edge Function timeout**: Not possible on Lovable Cloud
2. **Move to async pattern**: Return immediately with job ID, poll for status
3. **Optimize Vercel API**: Pre-warm, reduce RPC calls, cache blockhash
4. **Skip image upload**: Upload in background after returning
