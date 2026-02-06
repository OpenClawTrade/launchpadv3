
# Fix CORS Errors and Edge Function Access Issues

## Problem Summary

Users are experiencing multiple errors when accessing the application:

1. **CORS Error on `agent-idea-generate`**: Blocked by browser because preflight response doesn't allow all headers
2. **401 Unauthorized on `/api/vanity/status`**: Missing required `x-vanity-secret` header
3. **Similar CORS issues on other edge functions** used by the frontend

## Root Causes

### Issue 1: Incomplete CORS Headers

The Supabase JS client sends additional headers that must be explicitly whitelisted:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

**Current headers in affected functions:**
```typescript
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
```

**Required headers:**
```typescript
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

### Issue 2: Vanity Status Auth Check

The `/api/vanity/status` endpoint expects a hardcoded secret header that the frontend doesn't appear to be sending:
```typescript
const authHeader = req.headers['x-vanity-secret'];
const expectedSecret = '123456';
```

## Solution

### Step 1: Fix CORS Headers in Edge Functions

Update the following edge functions to include the full CORS header set:

| Function | File Path |
|----------|-----------|
| agent-idea-generate | `supabase/functions/agent-idea-generate/index.ts` |
| trading-agent-list | `supabase/functions/trading-agent-list/index.ts` |
| update-profile | `supabase/functions/update-profile/index.ts` |
| ai-chat | `supabase/functions/ai-chat/index.ts` |
| token-metadata | `supabase/functions/token-metadata/index.ts` |
| sol-price | `supabase/functions/sol-price/index.ts` |

**Code change for each:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### Step 2: Fix Vanity Status Endpoint

Either remove the hardcoded secret (if endpoint should be public) or ensure the frontend sends the correct header.

**Option A - Remove auth check (simpler, endpoint returns non-sensitive stats):**
```typescript
// Remove lines 43-48 from api/vanity/status.ts
```

**Option B - Keep auth but fix frontend to send header:**
```typescript
// In frontend when calling vanity status:
fetch('/api/vanity/status', {
  headers: { 'x-vanity-secret': '123456' }
})
```

I recommend Option A since the vanity status endpoint only returns public statistics about available vanity addresses.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/agent-idea-generate/index.ts` | Update CORS headers |
| `supabase/functions/trading-agent-list/index.ts` | Update CORS headers |
| `supabase/functions/update-profile/index.ts` | Update CORS headers |
| `supabase/functions/ai-chat/index.ts` | Update CORS headers |
| `supabase/functions/token-metadata/index.ts` | Update CORS headers |
| `supabase/functions/sol-price/index.ts` | Update CORS headers |
| `api/vanity/status.ts` | Remove hardcoded auth check |

## Expected Outcome

After implementation:
1. No more CORS errors when calling edge functions from `tuna.fun`
2. No more 401 errors on vanity status endpoint
3. Agent idea generation works from TunaBook page
4. Trading agent list loads properly
5. All other frontend-facing edge functions work without CORS issues
