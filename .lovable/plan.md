

# Fix: Token Image Generation Failure for Agent Launches

## Problem Summary

The **Inverse Cramer Bitcoin ($CRAMER)** token was launched without an image because the AI image generation failed with a **400 error**. This happened because:

1. The `agent-process-post` edge function uses the **wrong API endpoint and model** for image generation
2. When image generation fails, the token still launches with a `null` image URL
3. Both the on-chain metadata and database store no image, causing financial loss

## Root Cause Analysis

### Evidence from Logs
```
2026-02-02T19:38:11Z INFO  [agent-process-post] 🎨 No valid image URL, generating AI image for Inverse Cramer Bitcoin,...
2026-02-02T19:38:11Z ERROR [generateTokenImageWithAI] Image generation failed: 400
2026-02-02T19:38:12Z INFO  [agent-process-post] Calling create-fun API for Inverse Cramer Bitcoin,...
```

### Database Evidence
```sql
-- Both tables show image_url = NULL
SELECT image_url FROM fun_tokens WHERE ticker ILIKE '%CRAMER%';  -- NULL
SELECT image_url FROM tokens WHERE ticker ILIKE '%CRAMER%';      -- NULL
```

### Code Issue
The `generateTokenImageWithAI` function in `agent-process-post/index.ts` uses:
- **Wrong endpoint**: `/v1/images/generations` 
- **Wrong model**: `flux.schnell`

But the **working** implementation in `twitter-mention-launcher/index.ts` uses:
- **Correct endpoint**: `/v1/chat/completions`
- **Correct model**: `google/gemini-2.5-flash-image`

---

## Solution

### 1. Fix the Image Generation Function

Update `supabase/functions/agent-process-post/index.ts` to use the correct Lovable AI gateway format:

**Before (broken):**
```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
  body: JSON.stringify({
    model: "flux.schnell",
    prompt,
    n: 1,
    size: "512x512",
  }),
});
```

**After (fixed):**
```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
  body: JSON.stringify({
    model: "google/gemini-3-pro-image-preview",
    prompt,
  }),
});
```

### 2. Add Fallback Retry with Alternative Model

If the first model fails, try an alternative model before giving up:

```typescript
// Primary attempt
let imageUrl = await tryGenerateImage("google/gemini-3-pro-image-preview", prompt);

// Fallback if primary fails
if (!imageUrl) {
  console.log("[agent-process-post] Retrying image generation with fallback model...");
  imageUrl = await tryGenerateImage("google/gemini-2.5-flash", prompt);
}
```

### 3. Add Failure Prevention: Block Token Launch Without Image

To prevent financial loss from tokens launching without images:

```typescript
// In processLaunchPost function
if (!finalImageUrl) {
  console.log(`[agent-process-post] 🎨 No valid image URL, generating AI image for ${parsed.name}...`);
  
  finalImageUrl = await generateTokenImageWithAI(...);
  
  // CRITICAL: If no image, abort the launch
  if (!finalImageUrl) {
    throw new Error("Failed to generate token image - cannot launch without image");
  }
}
```

### 4. Fix Existing CRAMER Token (Immediate Action)

Run a database update to fix the $CRAMER token image:

```sql
-- Generate and upload an image for CRAMER, then update:
UPDATE fun_tokens 
SET image_url = '[uploaded_image_url]'
WHERE mint_address = 'HWzFtWfTFcgHLrxQ7Exd3PrZ17Mw82rdHXxvA9mCQtna';

UPDATE tokens 
SET image_url = '[uploaded_image_url]'
WHERE mint_address = 'HWzFtWfTFcgHLrxQ7Exd3PrZ17Mw82rdHXxvA9mCQtna';
```

---

## Files to Modify

1. **`supabase/functions/agent-process-post/index.ts`**
   - Update `generateTokenImageWithAI` function with correct API endpoint/model
   - Add fallback model retry
   - Add error handling to block launch if image generation fails

2. **Database migration** (optional)
   - Add a manual image for the CRAMER token

---

## Prevention Measures

1. **Unified Image Generation**: Create a shared utility function used by both `agent-process-post` and `twitter-mention-launcher` to prevent future inconsistencies

2. **Mandatory Image Validation**: Never allow token launch if `image_url` is null for agent-created tokens

3. **Logging Enhancement**: Log the full error response body (not just status code) for debugging

---

## Testing After Fix

1. Trigger a test token launch via Twitter/X mention
2. Verify the image is generated and uploaded to storage
3. Confirm the image URL is stored in both `fun_tokens` and `tokens` tables
4. Verify the on-chain metadata shows the correct image

