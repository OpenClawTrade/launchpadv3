
# Fix Promote-Generate Edge Function CORS Headers

## Problem
The `promote-generate` edge function is returning a 400 error: `"funTokenId and promoterWallet are required"`. This happens because the **CORS headers are incomplete**, causing the browser's preflight (OPTIONS) request to fail, which prevents the actual POST request body from being sent.

## Root Cause
The current CORS `Access-Control-Allow-Headers` only includes:
```
authorization, x-client-info, apikey, content-type
```

But the Supabase client sends additional headers that are not whitelisted:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

When the browser's preflight OPTIONS request doesn't receive permission for these headers, the actual POST request fails or sends an empty body.

---

## Solution

Update the CORS headers in `supabase/functions/promote-generate/index.ts` to include all required Supabase client headers:

**File:** `supabase/functions/promote-generate/index.ts`

**Change (line 6-9):**

From:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

To:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/promote-generate/index.ts` | Update CORS `Access-Control-Allow-Headers` to include all Supabase client headers |

---

## After Fix

Once deployed, the promote modal will correctly:
1. Pass the browser's preflight check
2. Send the `funTokenId` and `promoterWallet` in the POST body
3. Generate a payment address and QR code for the user
