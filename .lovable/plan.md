
# Fix X Agent Launch Metadata (Image, Twitter URL, SubTuna Website)

## Problem Summary

When tokens are launched via `!tunalaunch` on X, the **metadata is not being stored correctly** in the database even though the twitter-mention-launcher passes the correct values:

| Issue | What Should Happen | What's Broken |
|-------|-------------------|---------------|
| **Website URL** | `https://tuna.fun/t/{TICKER}` | Stored as `null` |
| **Twitter URL** | `https://x.com/{username}/status/{tweet_id}` | Sometimes stored as `https://x.com/i/status/...` or default `https://x.com/BuildTuna` |
| **Image** | Downloaded from X post, re-hosted to Supabase storage | Working correctly in most cases |

## Root Cause

The Vercel endpoint `api/pool/create-fun.ts` has conditional logic that **only auto-populates SubTuna website URL for agent launches** (when `agentId` is passed):

```typescript
// Line 270-273 in api/pool/create-fun.ts
const finalWebsiteUrl = websiteUrl && websiteUrl.trim() !== '' 
  ? websiteUrl 
  : (agentId ? `https://tuna.fun/t/${ticker.toUpperCase()}` : undefined);  // BUG!
```

The `twitter-mention-launcher` **does pass `websiteUrl` and `twitterUrl`** correctly (lines 501-502, 726-732), but the Vercel endpoint is:

1. Not receiving them properly OR
2. Overwriting them with defaults OR  
3. Not passing them to the `backend_create_token` function

## Solution

### Phase 1: Fix Vercel Endpoint (`api/pool/create-fun.ts`)

**Change 1**: Always use the passed `websiteUrl` and `twitterUrl` when provided, regardless of `agentId`:

```typescript
// Before (broken)
const finalWebsiteUrl = websiteUrl && websiteUrl.trim() !== '' 
  ? websiteUrl 
  : (agentId ? `https://tuna.fun/t/${ticker.toUpperCase()}` : undefined);

// After (fixed) - always auto-populate SubTuna link for ALL launches
const finalWebsiteUrl = websiteUrl && websiteUrl.trim() !== '' 
  ? websiteUrl 
  : `https://tuna.fun/t/${ticker.toUpperCase()}`;

// Twitter: Don't fall back to BuildTuna when explicitly passed
const finalTwitterUrl = twitterUrl && twitterUrl.trim() !== '' 
  ? twitterUrl 
  : undefined;  // No fallback - leave blank if not provided
```

**Change 2**: Fix the `i/status` broken Twitter URL format:
- When `twitterUrl` contains `/i/status/`, it's a broken format (missing username)
- Treat it as invalid and leave blank instead of storing garbage

```typescript
// Validate twitter URL format
const isValidTwitterUrl = twitterUrl && 
  twitterUrl.includes('x.com/') && 
  !twitterUrl.includes('/i/status/');  // Reject broken format

const finalTwitterUrl = isValidTwitterUrl ? twitterUrl : undefined;
```

### Phase 2: Verify Database Storage

Ensure `pending_token_metadata` and `backend_create_token` calls use the corrected `finalWebsiteUrl` and `finalTwitterUrl`:

- `pending_token_metadata.insert()` at line 406 - already uses `finalWebsiteUrl` and `finalTwitterUrl`
- `backend_create_token` RPC at line 537 - already uses `p_website_url: finalWebsiteUrl` and `p_twitter_url: finalTwitterUrl`

### Phase 3: Verify `token-metadata` Edge Function

Ensure the metadata endpoint returns these fields correctly:

- Check that `external_url` is set to `website_url`
- Check that `extensions.twitter` is set to `twitter_url`
- Check that `properties.links` contains both

## Files to Modify

| File | Changes |
|------|---------|
| `api/pool/create-fun.ts` | Fix `finalWebsiteUrl` to always default to SubTuna, fix `finalTwitterUrl` to reject `/i/status/` format |
| `supabase/functions/token-metadata/index.ts` | Verify metadata output (may need adjustment) |

## Technical Details

### Database Query Showing the Problem

```sql
SELECT mint_address, twitter_url, website_url FROM fun_tokens 
WHERE created_at > now() - interval '24 hours'
```

Results show:
- X launches with proper twitter-mention-launcher: `website_url = https://tuna.fun/t/TICKER` ✓
- Other launches: `website_url = null` ✗
- Some have `twitter_url = https://x.com/i/status/...` (broken format)

### Why Images Work But Socials Don't

The `twitter-mention-launcher` correctly:
1. Downloads image from X post
2. Re-hosts to Supabase storage (`post-images` bucket)
3. Passes the hosted URL to `api/pool/create-fun`

The image works because it's passed as `imageUrl` which is not conditionally overwritten.

The socials fail because `api/pool/create-fun` has conditional logic that ignores the passed values when `agentId` is not set.

## Validation

After implementation:
1. Launch token via `!tunalaunch` on X
2. Verify in database: `website_url = https://tuna.fun/t/{TICKER}`
3. Verify in database: `twitter_url = https://x.com/{username}/status/{id}`
4. Check token-metadata endpoint returns correct `external_url` and `extensions.twitter`
5. Verify on Solscan/Axiom that links appear

## Risk Assessment

- **Low risk**: Changes are isolated to social URL handling
- **No breaking changes**: Tokens that already have correct URLs will not be affected
- **Backward compatible**: Falls back gracefully when URLs are not provided
