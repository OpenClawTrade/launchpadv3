
# Use User-Attached Images Instead of AI-Generated Ones

## Problem
When a user tweets `!clawmode` with an attached image, the system ignores the attached image and always uses an AI-generated one. The auto-generate flow in `agent-process-post` calls `claw-trading-generate` which produces its own image, and the `attachedMediaUrl` parameter is never checked in that code path.

## Solution
In the auto-generate flow, check if `attachedMediaUrl` is present. If so, re-host that image (upload to storage) and use it as the token image instead of generating one with AI. The AI will still generate the name, ticker, and description, but the image will come from the user's tweet.

## Changes

### 1. `supabase/functions/agent-process-post/index.ts`

In the auto-generate block (around line 858), add a check before the AI image re-hosting:

```
// BEFORE (line ~858-859):
let finalImageUrl = genResult.imageUrl;

// AFTER:
// If user attached an image, use it instead of AI-generated image
let finalImageUrl: string;
if (attachedMediaUrl && !attachedMediaUrl.startsWith("https://t.co/") && !attachedMediaUrl.startsWith("http://t.co/")) {
  console.log(`[agent-process-post] 📷 User attached image - using instead of AI-generated: ${attachedMediaUrl.slice(0, 80)}...`);
  finalImageUrl = attachedMediaUrl;
} else {
  finalImageUrl = genResult.imageUrl;
}
```

This ensures:
- If the user attached a valid image (not a t.co shortlink), it takes priority over the AI-generated image
- The existing re-hosting logic (base64 upload or HTTP re-host) still runs on whatever URL is chosen
- Name, ticker, and description are still AI-generated from the prompt
- No changes needed in the Twitter scanner -- it already extracts and passes `mediaUrl` correctly
