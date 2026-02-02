

# Fix: Token Metadata Missing Images and Socials

## Problem Summary

Multiple tokens are being launched with missing metadata:
1. **Missing images** - e.g., CRAMER, CR1K, HBB have `image_url: NULL`
2. **Missing socials** - Many tokens have `twitter_url` and `website_url` as NULL
3. **On-chain metadata is broken** - Axiom/Birdeye/Solscan show empty data

## Root Causes Identified

### Issue 1: AI Image Generation Failures Not Blocking Launch

The blocking logic at `agent-process-post:532-566` SHOULD stop launches when image generation fails, but there's a race condition:

1. `agent-process-post` calls Vercel API at line 681
2. Vercel API (`create-fun.ts`) creates token in DB with `imageUrl: null`
3. Even if `agent-process-post` tries to block, the token is already created on-chain

The fundamental issue: **Vercel API creates the token before agent-process-post can block it**.

### Issue 2: Update Path Doesn't Include Image/Socials

When a token already exists (created by Vercel API), lines 747-755 only update:
```typescript
.update({
  agent_id: agent.id,
  agent_fee_share_bps: 8000,
})
```

It does NOT update: `image_url`, `website_url`, `twitter_url`, etc.

### Issue 3: t.co Shortlinks Rejected But No Media Fallback

When users include `Image: https://t.co/xxx` in their tweet:
- The t.co shortlink is correctly rejected (line 502-504)
- But the attached media from the tweet may not be extracted by X API
- AI generation may fail silently
- Token gets created without image

## Solution

### Phase 1: Fix the Update Path (Critical)

**File: `supabase/functions/agent-process-post/index.ts`**

Update lines 749-755 to include ALL metadata fields when updating an existing token:

```typescript
if (existing?.id) {
  funTokenId = existing.id;
  await supabase
    .from("fun_tokens")
    .update({
      // Always update agent attribution
      agent_id: agent.id,
      agent_fee_share_bps: 8000,
      // Update image if we have one (don't overwrite with null)
      ...(finalImageUrl && { image_url: finalImageUrl }),
      // Update socials if we have them
      ...(parsed.website && { website_url: parsed.website }),
      ...((postUrl || parsed.twitter) && { twitter_url: postUrl || parsed.twitter }),
      ...(parsed.telegram && { telegram_url: parsed.telegram }),
      ...(parsed.discord && { discord_url: parsed.discord }),
      // Always set description if we have it
      ...(parsed.description && { description: parsed.description }),
    })
    .eq("id", funTokenId);
}
```

### Phase 2: Move Image Validation Before API Call (Critical)

**File: `supabase/functions/agent-process-post/index.ts`**

The blocking logic at line 532-566 is correct, but we need to ensure it executes BEFORE calling the Vercel API. The current flow is:

```
1. Parse post
2. Validate image (block if null) ← Line 532
3. Insert "processing" record ← Line 569
4. Call Vercel API ← Line 681
```

This should work, but add additional logging to confirm the flow:

```typescript
// Line 532 - Add explicit confirmation
if (!finalImageUrl) {
  const errorMsg = "BLOCKED: Cannot launch without image";
  console.error(`[agent-process-post] ❌ ${errorMsg} - token: ${parsed.name}`);
  // ... existing error handling
  return { success: false, error: errorMsg };
}

console.log(`[agent-process-post] ✅ Image validation passed: ${finalImageUrl.slice(0, 50)}...`);
```

### Phase 3: Improve AI Image Generation Reliability

**File: `supabase/functions/agent-process-post/index.ts`**

Add more robust error handling and logging in `generateTokenImageWithAI`:

```typescript
// Lines 73-146 - Add detailed error logging
async function generateTokenImageWithAI(...) {
  console.log(`[generateTokenImageWithAI] Starting for ${tokenName} (${tokenSymbol})`);
  
  // ... existing retry logic ...
  
  if (!imageUrl) {
    console.error(`[generateTokenImageWithAI] ❌ FAILED: All ${IMAGE_MODELS.length} models failed`);
    console.error(`[generateTokenImageWithAI] Token: ${tokenName}, Symbol: ${tokenSymbol}`);
    return null;
  }
  
  // ... rest of function
}
```

### Phase 4: Fix the Mint Address Discrepancy

The user linked to `895WtPwn6NnWh5uW9o23kSUZx13K5gjuPVuXJFr6qNtR` which doesn't exist in our database. This indicates either:
- Token created through external means
- Database insert failed after on-chain creation

**File: `api/pool/create-fun.ts`**

Add a safety check: If database insert fails after on-chain confirmation, log the mint address for recovery:

```typescript
// After line 425
if (tokenError) {
  console.error(`[create-fun][${VERSION}] CRITICAL: Token created on-chain but DB insert failed!`);
  console.error(`[create-fun][${VERSION}] Mint: ${mintAddress}, Pool: ${dbcPoolAddress}`);
  console.error(`[create-fun][${VERSION}] Metadata: ${JSON.stringify({ name, ticker, imageUrl })}`);
  throw new Error(`Failed to create token record: ${tokenError.message}`);
}
```

### Phase 5: Backfill Missing Images (Data Fix)

For tokens already created with `image_url: NULL`, create a one-time fix script:

```sql
-- Identify affected tokens
SELECT id, name, ticker, mint_address, created_at 
FROM fun_tokens 
WHERE image_url IS NULL 
ORDER BY created_at DESC;

-- These need manual image generation/upload
```

The agent owners would need to manually upload images, or we could run AI generation for them.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/agent-process-post/index.ts` | Fix update path to include image/socials; Add logging |
| `api/pool/create-fun.ts` | Add error logging for DB failures |

## Testing Plan

1. Deploy edge function changes
2. Attempt a test launch with a t.co shortlink image (should generate AI fallback)
3. Verify the token has correct image and socials in database
4. Check Axiom/Solscan for correct metadata display

## Summary

The main fix is updating lines 749-755 in `agent-process-post` to include image and social URLs when updating an existing token. This ensures that even if the Vercel API creates the token first, the metadata gets populated correctly from the parsed tweet data.

