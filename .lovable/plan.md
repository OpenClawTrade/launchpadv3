

## Fix: Better Token Names & Tickers for !clawmode Launches

### Problem
The AI prompt in `twitter-mention-launcher` generates overly long or nonsensical names and random-looking tickers like "PPA", "PNQR", "PPCA". The prompt says "Single word, catchy, max 12 chars" but still produces poor results because it lacks strong enough constraints and examples.

### Solution
Rewrite the AI prompt in `generateTokenFromTweet()` inside `supabase/functions/twitter-mention-launcher/index.ts` (lines 763-776) with much tighter instructions:

**Changes to the prompt:**
- Name: Force 1-2 short words, meme-style (e.g., "Pepe", "Doge", "Moon Cat", "Rug Bird")
- Ticker: Must come from the name logically (first word or abbreviation that makes sense), 3-6 chars
- Add explicit BAD examples to avoid: "NEVER generate random letter combos like PPA, PNQR, PPCA"
- Add more GOOD examples showing name-to-ticker mapping: "Pepe -> PEPE", "Moon Cat -> MOON", "Rug Bird -> RUG"
- Lower temperature from 0.9 to 0.8 for slightly more coherent output

**Also update the ticker fallback logic** (line 819): currently falls back to `parsed.name?.slice(0, 4)` which can produce gibberish. Instead, extract only uppercase alpha chars from the name.

### File Changed
- `supabase/functions/twitter-mention-launcher/index.ts` -- Update `generateTokenFromTweet()` function (lines 763-821)

### Technical Details

Updated prompt (lines 763-776):
```
Based on this tweet requesting a meme token, create a short catchy memecoin.

Tweet: "{cleanedTweetText}"

RULES:
1. Name: 1-2 short words, meme style. Max 10 chars total. Think: Pepe, Doge, Bonk, Moon Cat, Rug Rat
2. Ticker: 3-6 uppercase letters that MAKE SENSE from the name. Examples:
   - "Pepe" -> "PEPE"
   - "Moon Cat" -> "MOON" 
   - "Crab King" -> "CRAB"
   - "Bonk" -> "BONK"
   - "Doge Lord" -> "DOGE"
3. NEVER use random letter combos (PPA, PNQR, PPCA are BAD)
4. Description: Fun one-liner with 1-2 emojis, max 80 chars. No URLs.

Return ONLY valid JSON:
{"name": "TokenName", "ticker": "TICK", "description": "Fun description 🚀"}
```

Updated ticker fallback (line 819):
```typescript
// Extract first word of name as ticker fallback instead of random slice
ticker: (parsed.ticker || parsed.name?.split(/\s/)[0]?.replace(/[^A-Z]/gi, '') || "MEME").toUpperCase().slice(0, 6),
```

Temperature change (line 790): `0.9` to `0.8`
