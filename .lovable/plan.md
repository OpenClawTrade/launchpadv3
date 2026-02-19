
## Replace !launch with !clawmode Command

### Summary of the Clarification

The user confirmed: `!clawmode` **replaces** `!launch` entirely. The scanner should now search for `!clawmode` instead of `!launch`, and the auto-generation flow should use the lobster-themed `claw-trading-generate` function instead of `fun-generate`.

---

### What Changes

#### File 1: `supabase/functions/agent-scan-twitter/index.ts`

**Line 997 — Official X API search query:**
```
BEFORE: (tunalaunch OR launchtuna OR "!launch") -is:retweet
AFTER:  (tunalaunch OR launchtuna OR "!clawmode") -is:retweet
```

**Line 999 — twitterapi.io keyword fallback query:**
```
BEFORE: "!launch" -is:retweet -is:reply
AFTER:  "!clawmode" -is:retweet -is:reply
```

**Lines 1063-1067 — Secondary search log messages:**
Replace all references to `!launch keyword search` → `!clawmode keyword search`.

**Lines 1175-1178 — Command detection:**
```ts
BEFORE:
const launchMatch = tweetText.match(/!launch\s+(.+?)(?:\n|$)/i);
const isAutoLaunch = launchMatch && !tweetText.toLowerCase().includes("!tunalaunch") && ...
const autoLaunchPrompt = isAutoLaunch ? launchMatch[1].trim() : null;

AFTER:
const clawmodeMatch = tweetText.match(/!clawmode\s+(.+?)(?:\n|$)/i);
const isAutoLaunch = !!clawmodeMatch;
const autoLaunchPrompt = isAutoLaunch ? clawmodeMatch[1].trim() : null;
```
Note: No need to exclude `!tunalaunch` from this check — `!clawmode` is its own distinct command.

**Line 1225 — Command gate check:**
```ts
BEFORE: if (!normalizedText.toLowerCase().includes("!tunalaunch") && !isAutoLaunch)
AFTER:  if (!normalizedText.toLowerCase().includes("!tunalaunch") && !isAutoLaunch)
```
This line stays the same — if neither `!tunalaunch` nor `!clawmode` is found, the tweet is skipped.

**Lines 1325-1328 — Payload to agent-process-post:**
Already passes `autoGenerate: true` and `generatePrompt` when `isAutoLaunch`. No change needed here structurally.

**Line 1355-1356 — Success reply text:**
```ts
BEFORE: const feePercent = isAutoLaunch ? "70" : "80";
        const replyText = `🐟 Token launched on $SOL!\n\n$${ticker} - ${name}\nCA: ${ca}\n\nPowered by TUNA Agents - ${feePercent}% of fees go to you! ...`

AFTER:  const feePercent = isAutoLaunch ? "80" : "80";  // clawmode uses 80%
        const replyText = `🦞 Trading Agent launched on $SOL!\n\n$${ticker} - ${name}\nCA: ${ca}\n\nPowered by Claw Mode - 80% of fees fund your agent!`
```

---

#### File 2: `supabase/functions/agent-process-post/index.ts`

**Lines 782-820 — The `autoGenerate` code path:**

Currently calls `fun-generate` which generates a generic memecoin (tuna-themed). Replace with a call to `claw-trading-generate` to get a lobster-themed AI trading agent identity with image.

```ts
BEFORE: calls `${supabaseUrl}/functions/v1/fun-generate` with { description, imageStyle }
        expects response: { success, meme: { name, ticker, description, imageUrl } }

AFTER:  calls `${supabaseUrl}/functions/v1/claw-trading-generate` with { strategy: "balanced", personalityPrompt: generatePrompt }
        expects response: { success, name, ticker, personality, description, avatarUrl }
```

The `claw-trading-generate` function already:
- Generates a lobster/claw-themed name, ticker, personality, description via Gemini
- Generates an AI avatar image via Gemini image model
- Uploads the image to Supabase storage (`trading-agents` bucket)
- Returns `{ success, name, ticker, personality, description, avatarUrl }`

So the adapter in `agent-process-post` becomes:
```ts
genResult = {
  name: genData.name,
  ticker: genData.ticker,
  description: genData.description,
  imageUrl: genData.avatarUrl,  // already uploaded to storage, no re-host needed
};
```

**Fee split (line 1061):**
```ts
BEFORE: const AUTO_LAUNCH_FEE_BPS = 7000;  // 70% for !launch
AFTER:  const AUTO_LAUNCH_FEE_BPS = 8000;  // 80% for !clawmode (same as tunalaunch)
```

**Error reply text (line 844):**
```ts
BEFORE: 🐟 Hey @${postAuthor}! Image generation failed...
AFTER:  🦞 Hey @${postAuthor}! Agent generation failed. Please try again in a moment.
```

---

### What is NOT changed

- `!tunalaunch` — the original command still works (user attaches image themselves, 80% split). This is unchanged.
- The scanner's `normalizedText` replacement for `!launchtuna` → `!tunalaunch` stays in place.
- The `buildtuna` blocklist entry stays.
- The dedup logic, rate limiting, and all other scan logic are unchanged.

---

### Files Changed

| File | Lines Changed |
|---|---|
| `supabase/functions/agent-scan-twitter/index.ts` | Lines 997, 999, 1063-1067, 1175-1178, 1355-1356 |
| `supabase/functions/agent-process-post/index.ts` | Lines 783-820 (gen call), 1061 (fee BPS), 844 (error reply) |

No database schema changes. No new edge functions. No new secrets needed.

---

### How it works end-to-end after this change

```text
User tweets: "!clawmode a lobster who loves DeFi"
       ↓
agent-scan-twitter detects !clawmode pattern
       ↓
Calls agent-process-post with { autoGenerate: true, generatePrompt: "a lobster who loves DeFi" }
       ↓
agent-process-post calls claw-trading-generate with { strategy: "balanced", personalityPrompt: "..." }
       ↓
claw-trading-generate:
  → AI generates: name="ClawDeFi", ticker="CLAW", personality="Bold liquidity hunter"
  → AI generates lobster mascot image (Gemini image model)
  → Uploads image to storage → returns avatarUrl
       ↓
agent-process-post launches Meteora DBC token with the generated identity + image (80% fee)
       ↓
auto-reply: "🦞 Trading Agent launched on $SOL! $CLAW - ClawDeFi CA: ... Powered by Claw Mode - 80% of fees fund your agent!"
```
