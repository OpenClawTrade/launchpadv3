
# Fix: Token Metadata Caching for Newly Created Tokens

## Problem Summary

After thorough investigation, I've confirmed that:
- The database has **correct metadata** (image, twitter_url, website_url) for token `J3ARMNNrNJsBfbRjzJhddyhgiTVonTfhUkAjDbR9ZzW4`
- The `token-metadata` endpoint returns **complete, correct data**
- The on-chain metadata URI is correctly pointing to our endpoint

**Root Cause**: External platforms (Solscan, Axiom, DEXTools) cache the metadata response. The current `token-metadata` function uses a **1-hour cache** (`max-age=3600`) for ALL tokens, including newly created ones. If a platform queries metadata during the brief window before database population, or if they cached a fallback response, it persists for an hour.

## Solution

Implement **dynamic cache headers** based on token age:
- **New tokens (created < 10 minutes ago)**: Use `max-age=60` (1 minute) to allow rapid correction
- **Pending tokens**: Use `no-cache` to ensure fresh data
- **Established tokens (> 10 minutes old)**: Use `max-age=3600` (1 hour) as before

## Implementation Details

### File: `supabase/functions/token-metadata/index.ts`

**Changes:**

1. Track the token's `created_at` timestamp when fetching from database
2. Calculate token age
3. Set cache header dynamically based on age:

```typescript
// Determine cache duration based on token age
let cacheMaxAge = 3600; // Default 1 hour

if (tokenSource === 'pending_token_metadata') {
  // Pending tokens - no cache
  cacheMaxAge = 0;
} else {
  // Check if token was created within last 10 minutes
  const createdAt = token.created_at ? new Date(token.created_at) : null;
  if (createdAt) {
    const ageMs = Date.now() - createdAt.getTime();
    const tenMinutesMs = 10 * 60 * 1000;
    if (ageMs < tenMinutesMs) {
      // New token - short cache for rapid updates
      cacheMaxAge = 60;
      console.log(`[token-metadata] New token (<10min), using short cache: ${cacheMaxAge}s`);
    }
  }
}

// Set Cache-Control header
const cacheControl = cacheMaxAge === 0 
  ? 'no-cache, no-store' 
  : `public, max-age=${cacheMaxAge}`;
```

4. Update the TokenData interface to include `created_at`

### Sequence of Changes

1. Update the `TokenData` interface to include `created_at?: string`
2. Add logic after fetching token to calculate age
3. Modify the response to use dynamic cache headers

### Why This Works

- When a token is first created, external platforms that query immediately will get a 60-second cache
- If they cached a fallback/incomplete response, it will refresh within 1 minute
- After 10 minutes (when we're confident metadata is stable), we use the standard 1-hour cache for performance
- Pending metadata uses no-cache to ensure the latest data is always returned

### Additional Benefit

This also aligns with the existing memory note about metadata caching strategy, which mentioned this approach but wasn't fully implemented.

## Testing

After deployment:
1. Launch a new token from X
2. Immediately check Solscan/Axiom - may show incomplete data
3. Wait 1-2 minutes and refresh - should show correct metadata
4. Confirm the cache header in browser dev tools shows `max-age=60` for new tokens
