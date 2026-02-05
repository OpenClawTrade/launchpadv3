
# Fix Token Image and Metadata Reliability for X Launches

## ✅ IMPLEMENTED (2026-02-05)

All fixes have been deployed:

### Changes Made

1. **`twitter-mention-launcher`**: Added `expandTcoUrl()` function to expand t.co shortlinks BEFORE re-hosting. If expansion fails, launch is blocked with clear error message.

2. **`agent-process-post`**: 
   - Added `expandTcoUrl()` - attempts to expand t.co links instead of silently skipping
   - Added `isValidFinalImageUrl()` - strict validation after re-hosting to catch any remaining invalid URLs
   - Added fallback image sync after token creation - ensures `fun_tokens.image_url` is populated even if initial insert missed it

3. **Enhanced logging at every stage** for easier debugging

---

## Problem Summary

Some tokens launched via X/Twitter have **NULL image_url** in the database even though they successfully launched on-chain. This causes external explorers (Solscan, DexScreener, Birdeye) to show tokens without images.

**Evidence from database:**
| Token | parsed_image_url | fun_tokens.image_url | Issue |
|-------|------------------|----------------------|-------|
| CR1K | `https://t.co/HHumJtWXXX` | NULL | t.co URL not expanded/re-hosted |
| HBB | NULL | NULL | No image attached, but token still created |
| CRAMER | NULL | NULL | No agent_social_posts record found |

**Recent successful tokens (MISSRO, PINCER, etc.)** have proper re-hosted images - proving the fix works when all conditions are met.

---

## Root Causes Identified

### 1. t.co Shortlinks Not Being Expanded

**Location:** `supabase/functions/agent-process-post/index.ts` lines 704-718

The code correctly detects t.co URLs and sets `finalImageUrl = null`, but this happens **after** the image source is determined. The issue is in how `mediaUrls` are passed from tweet data - Twitter API sometimes returns t.co links in `mediaUrls` instead of expanded URLs.

**Evidence:** CR1K has `parsed_image_url: https://t.co/HHumJtWXXX` - a t.co link was stored directly without expansion.

### 2. Image Re-hosting Fails Silently in Some Paths

**Location:** `supabase/functions/agent-process-post/index.ts` `rehostImageIfNeeded()` function

The function properly follows redirects, but if the fetch fails or times out, the original URL (including t.co) is stored. The code at line 764-805 catches errors and blocks the launch, but there's a gap where the t.co URL might slip through parsing.

### 3. fun_tokens Table Not Updated with Image URL

**Location:** Database sync issue

When `create-fun.ts` Vercel API creates the token, it passes `imageUrl` to the database. But if the image URL is invalid or the upsert fails, the `image_url` column remains NULL even if `pending_token_metadata` has the correct image.

---

## Solution

### Fix 1: Expand t.co URLs in Tweet Media Before Processing

Add a t.co URL expansion step in `twitter-mention-launcher` BEFORE passing to `rehostImage()`:

```text
Location: supabase/functions/twitter-mention-launcher/index.ts (around line 387)

Current:
const rawImageUrl = mention.mediaUrls?.[0] || null;

Fix:
1. If rawImageUrl starts with https://t.co/, follow the redirect to get the actual image URL
2. Twitter media URLs should be like pbs.twimg.com/media/... not t.co links
3. If expansion fails, log error and block the launch
```

### Fix 2: Validate Image URL Format Before Token Creation

Add stricter validation to reject t.co URLs and other invalid formats:

```text
Location: supabase/functions/agent-process-post/index.ts

Add check after rehostImageIfNeeded():
- If final URL still contains "t.co/" - BLOCK launch
- If final URL doesn't match expected storage patterns - WARN but continue
- Log all image URL transformations for debugging
```

### Fix 3: Add Fallback Image Sync After Token Creation

Add a safety net that syncs `image_url` from `pending_token_metadata` to `fun_tokens` if missing:

```text
Location: supabase/functions/agent-process-post/index.ts (after token insert/update)

After fun_tokens insert:
1. Verify image_url was saved correctly
2. If NULL but pending_token_metadata has image, copy it over
3. Log any discrepancies for debugging
```

### Fix 4: Enhance Error Logging for Image Issues

Add comprehensive logging at each stage of image processing:

```text
Stages to log:
1. Raw image URL from tweet/mention
2. After t.co expansion (if applicable)
3. After re-hosting to storage
4. After database insert
5. Verify stored value matches expected
```

---

## Implementation Files

| File | Change | Priority |
|------|--------|----------|
| `supabase/functions/twitter-mention-launcher/index.ts` | Add t.co URL expansion before processing | High |
| `supabase/functions/agent-process-post/index.ts` | Add stricter t.co validation, fallback sync | High |
| `api/pool/create-fun.ts` | Log image URL issues | Medium |

---

## Technical Details

### t.co URL Expansion Function

```text
async function expandTcoUrl(shortUrl: string): Promise<string | null> {
  if (!shortUrl.includes('t.co/')) return shortUrl;
  
  try {
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0...' }
    });
    
    // Get the final URL after redirects
    const finalUrl = response.url;
    
    // Validate it's actually an image URL
    if (!finalUrl.includes('pbs.twimg.com') && !finalUrl.includes('/media/')) {
      console.warn(`t.co expanded to non-image URL: ${finalUrl}`);
      return null;
    }
    
    return finalUrl;
  } catch (e) {
    console.error(`Failed to expand t.co URL: ${e}`);
    return null;
  }
}
```

### Image URL Validation

```text
function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.includes('t.co/')) return false;  // Must be expanded first
  if (!url.startsWith('https://')) return false;
  
  // Accept our storage or common image CDNs
  const validPatterns = [
    '/storage/v1/object/public/',  // Supabase storage
    'pbs.twimg.com',               // Twitter CDN
    'cdn.discordapp.com',          // Discord CDN
    'i.imgur.com',                 // Imgur
  ];
  
  return validPatterns.some(p => url.includes(p));
}
```

---

## Testing Checklist

After implementation:
1. Launch token via X with attached image - verify image appears on Solscan
2. Check fun_tokens table - image_url should be re-hosted Supabase URL
3. Check pending_token_metadata - should match fun_tokens
4. Try launching with t.co link in tweet text - should be blocked or expanded
5. Try launching without image - should be blocked with clear error message

---

## Data Cleanup

For existing tokens with NULL images, run SQL update to pull from pending_token_metadata if available:

```sql
UPDATE fun_tokens ft
SET image_url = ptm.image_url
FROM pending_token_metadata ptm
WHERE ft.mint_address = ptm.mint_address
  AND (ft.image_url IS NULL OR ft.image_url = '')
  AND ptm.image_url IS NOT NULL
  AND ptm.image_url != '';
```
