

## Fix: Clean Up Twitter-Launched Token Metadata

### Problem Identified

After investigating, I found that:

1. **Token `3XD8FSUuxLH4gGTQQdF3jai6TRc1isKihN8N1pFYYsWw` (ATUNA) actually HAS correct metadata** in the database:
   - Image: ✅ `https://ptwytypavumcrbofspno.supabase.co/storage/v1/object/public/post-images/fun-tokens/x-2018942040143167496-1770188286623-atuna.jpg`
   - The `token-metadata` endpoint correctly returns all metadata

2. **The issue is description pollution** - AI-generated descriptions contain t.co URLs from tweets:
   ```
   "AnonTuna: The digital sushi rogue! 🍣💻 Stealing hearts & hacking charts! 🚀... https://t.co/dfqm07GCuA"
   ```

3. **Multiple tokens are affected** - PayTuna, WhaleFin, Sushi Shark, AstroTUNA, ElonTuna, SwapTuna, and others all have t.co URLs in descriptions.

### Root Cause

In `twitter-mention-launcher/index.ts`, the `generateTokenFromTweet` function passes the full tweet text (including t.co links) to the AI, and the AI sometimes echoes these URLs in the description it generates.

### Implementation Plan

#### 1. Sanitize AI Input in `twitter-mention-launcher`
**File:** `supabase/functions/twitter-mention-launcher/index.ts`

Strip t.co URLs from tweet text BEFORE sending to AI:
```typescript
async function generateTokenFromTweet(tweetText, imageUrl, apiKey) {
  // Strip all t.co URLs from tweet text before AI processing
  const cleanedTweetText = tweetText.replace(/https?:\/\/t\.co\/\S+/gi, '').trim();
  
  const prompt = `Based on this tweet requesting a meme token creation...
  Tweet: "${cleanedTweetText}"
  ...`;
}
```

#### 2. Sanitize AI Output
Also strip t.co URLs from the AI-generated description as a fallback:
```typescript
return {
  name: parsed.name?.slice(0, 12) || "MemeToken",
  ticker: (parsed.ticker || parsed.name?.slice(0, 4) || "MEME").toUpperCase().slice(0, 5),
  // Clean t.co URLs from AI-generated description
  description: (parsed.description || "A fun meme coin! 🚀")
    .replace(/https?:\/\/t\.co\/\S+/gi, '')
    .replace(/\.\.\./g, '')
    .trim()
    .slice(0, 100),
};
```

#### 3. Add Sanitization in `agent-process-post`
**File:** `supabase/functions/agent-process-post/index.ts`

Clean user-provided descriptions too:
```typescript
case "description":
case "desc":
  // Strip t.co URLs from user-provided descriptions
  data.description = trimmedValue
    .replace(/https?:\/\/t\.co\/\S+/gi, '')
    .trim()
    .slice(0, 500);
  break;
```

#### 4. Sanitize Before Token Creation API
In the `createToken` call, ensure description is cleaned:
```typescript
const tokenResult = await createToken({
  ...
  description: tokenConcept.description.replace(/https?:\/\/t\.co\/\S+/gi, '').trim(),
  ...
});
```

### Technical Details

- **Regex used:** `https?:\/\/t\.co\/\S+` - matches both http and https t.co shortlinks
- **Global flag `gi`** - replaces all occurrences, case-insensitive
- **Three layers of protection:**
  1. Clean input before AI generation
  2. Clean AI output after generation  
  3. Clean final description before on-chain submission

### Files to Modify

1. `supabase/functions/twitter-mention-launcher/index.ts`
   - Add t.co cleanup in `generateTokenFromTweet` function
   - Add cleanup in `createToken` call

2. `supabase/functions/agent-process-post/index.ts`
   - Add t.co cleanup in `assignParsedField` for description field
   - Add cleanup before API call

### Testing

After implementation:
1. Launch a test token from X with an image attached
2. Verify the description in `fun_tokens` table doesn't contain t.co URLs
3. Verify the `token-metadata` endpoint returns clean descriptions
4. Check external platforms (Axiom, Solscan) display metadata correctly

