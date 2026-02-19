
# Complete Audit: "tuna.fun" & TUNA Brand References

Here is every single location where `tuna.fun` or old TUNA branding appears across the entire codebase. I've organized them by file and what action should be taken.

---

## SECTION 1 — The Daily/Hourly X Post (DISABLE)

**File:** `supabase/functions/agent-hourly-post/index.ts`

This function posts an automated tweet every 24 hours to the `@clawmode` account. The tweet content reads:

```
🐟 TUNA Daily Update
📊 Last 24 Hours: ...
🔗 clawmode.fun/agents
#TunaFun #AIAgents #Solana
```

**Problems:**
- Title says "TUNA Daily Update" (should be "Claw Mode Daily Update")
- Hashtag `#TunaFun` (should be `#ClawMode`)
- The fish emoji `🐟` is still TUNA-branded

**Recommendation:** Update the tweet template OR disable this function entirely by removing its cron job.

---

## SECTION 2 — `tuna.fun` URLs in Edge Functions (REPLACE WITH `clawmode.fun`)

These files generate URLs that point to `tuna.fun` — they appear in token launch posts, welcome messages, Telegram messages, API responses, and on-chain metadata.

### `supabase/functions/agent-process-post/index.ts` (MANY occurrences)
- `https://tuna.fun/t/${finalTicker}` — used as `communityUrl` on-chain (lines 1017, 1485)
- `https://tuna.fun/launchpad/${mintAddress}` — used in agent welcome posts (lines 1132, 1700, 1766, 1803)
- `https://tuna.fun/launchpad/${mintAddress}` — returned as `tradeUrl` in API response (line 1166)
- Comment at line 1515: "website: community URL (tuna.fun/t/TICKER)"

### `supabase/functions/agent-launch/index.ts`
- `https://tuna.fun/launchpad/${token.mintAddress}` inside a Telegram message: "Trade on TUNA" (line 59) — label also says "TUNA"
- `https://tuna.fun/t/${tickerUpper}` as `communityUrl` (line 229)
- `https://tuna.fun/launchpad/${mintAddress}` in agent welcome post content (line 349)
- `https://tuna.fun/launchpad/${mintAddress}` as `tradeUrl` response (line 388)

### `supabase/functions/pump-agent-launch/index.ts`
- `https://tuna.fun/t/${ticker.toUpperCase()}` as default website (line 119)
- `https://x.com/BuildTuna` as default Twitter (line 120) — this should become `@clawmode`

### `supabase/functions/twitter-mention-launcher/index.ts`
- `https://tuna.fun/t/${tokenConcept.ticker.toUpperCase()}` as websiteUrl (line 649)

### `supabase/functions/trading-agent-create/index.ts`
- `https://tuna.fun/t/${finalTicker.toUpperCase()}` as websiteUrl for on-chain metadata (line 131)

### `supabase/functions/admin-check-agent-balance/index.ts`
- `TRADING_AGENT_BASE_URL = "https://tuna.fun/agents/trading"` (line 57)
- `https://tuna.fun/t/${ticker}` as agentLink (line 94)

### `supabase/functions/agent-register/index.ts`
- `dashboardUrl: "https://tuna.fun/agents/dashboard"` (line 140) — returned to external agents when they register

### `supabase/functions/agent-claim-verify/index.ts`
- `dashboardUrl: "https://tuna.fun/agents/dashboard"` (line 174) — returned to external agents on claim verify

---

## SECTION 3 — `tuna.fun` in Colosseum Functions (REPLACE)

### `supabase/functions/colosseum-forum/index.ts`
- `https://tuna.fun` (line 48)
- `https://tuna.fun/agents/docs` (line 49)
- `https://tuna.fun/skill.md` (line 50)
These are posted to the Colosseum hackathon forum as the platform description.

### `supabase/functions/colosseum-auto-engage/index.ts`
- `"All live at tuna.fun!"` (line 63)
- `"tuna.fun/t/TUNA"` (line 64)
These are hardcoded metric strings the bot posts on Colosseum.

---

## SECTION 4 — `tuna.fun` in CLI (REPLACE)

### `cli/package.json`
- `"author": "OpenTuna Team <team@tuna.fun>"` (line 24)
- `"homepage": "https://tuna.fun/opentuna"` (line 26)

### `cli/src/commands/init.ts`
- `fetch('https://tuna.fun/api/agents/register', ...)` (line 92) — the CLI calls the old tuna.fun API

---

## SECTION 5 — `tuna.fun` in Smart Contracts (REPLACE)

### `contracts/flaunch/script/Deploy.s.sol`
- `"https://api.tuna.fun/metadata/testnet/"` (line 68)
- `"https://api.tuna.fun/metadata/"` (line 69)
These are the base URIs for NFT metadata in the smart contract deploy script.

---

## SECTION 6 — `tuna.fun` in API Functions (REPLACE)

### `api/pool/create-phantom.ts`
- `https://tuna.fun/t/${tokenSymbol}` as default website (line 284)

---

## SECTION 7 — TUNA Brand in Frontend UI (RENAME)

### `src/components/launchpad/TunaPulse.tsx`
- Component is named `TunaPulse` — displays as **"TUNA Pulse"** in the UI header (line 165)
- Should be renamed to `ClawPulse` or "Claw Mode Pulse"

### `src/components/agents/AgentPlatformToken.tsx`
- `name: "$TUNA"` (line 6)
- `description: "The TUNA platform token..."` (line 7)
This component references $TUNA as the platform token.

### `src/components/LaunchCountdown.tsx`
- `"New $TUNA launches when the timer hits zero"` (line 82)

### `src/pages/WhitepaperPage.tsx`
- `"$TUNA Token:"` label (line 1070) with the hardcoded mint address

---

## SECTION 8 — Old Bot Usernames Still Referenced (AUDIT/REPLACE)

### `supabase/functions/pump-agent-launch/index.ts`
- Default Twitter: `https://x.com/BuildTuna` (line 120) — should be `https://x.com/clawmode`

### `supabase/functions/api-launch-token/index.ts`
- Default Twitter: `https://x.com/BuildTuna` (line 114)

### `supabase/functions/agent-auto-engage/index.ts`
- Comment: "Special content for SystemTUNA - always about $TUNA utility and tuna.fun" (line 401)
- System prompt references `SystemTUNA` persona (line 440)
- Content prompt mentions `$TUNA or clawmode.fun` (line 412)

### `supabase/functions/agent-scan-twitter/index.ts`
- Bot blocklist still contains: `"buildtuna", "tunalaunch", "tunabot", "tuna_launch", "build_tuna", "tunaagent"` (line 1201)
These are fine to keep as a blocklist since they protect against replying to old bot accounts.

### `supabase/functions/test-twitterapi-reply/index.ts`
- Test tweet text: `"🐟 TUNA test ${marker}"` (line 114)

### `supabase/functions/test-community/index.ts`
- Checks if `BuildTuna` is a community member (lines 200–220)

---

## Proposed Actions

### 1. DISABLE: `agent-hourly-post` cron job
Remove the cron job so no more "TUNA Daily Update" tweets fire automatically. The function itself can remain but be dormant, or we rewrite the tweet template to say "Claw Mode Daily Update" with `#ClawMode` hashtag.

### 2. REPLACE everywhere: `tuna.fun` → `clawmode.fun`
All URLs that point to `tuna.fun` in edge functions need to change to `clawmode.fun`. This affects:
- Token trade links (launchpad URLs)
- Community URLs embedded in on-chain metadata
- Dashboard URLs returned to external agent developers
- Default website fallbacks when launching tokens

### 3. RENAME in frontend: `TunaPulse` → `ClawPulse`
- Rename the component file, export, and display name
- Change the visible header text from "TUNA Pulse" to "Claw Pulse" or "Claw Mode Pulse"

### 4. UPDATE: Default Twitter handles
- `https://x.com/BuildTuna` → `https://x.com/clawmode` in `pump-agent-launch` and `api-launch-token`

### 5. UPDATE: `agent-auto-engage` SystemTUNA persona
- Rename `SystemTUNA` references to `SystemClaw` or remove them
- Update content prompts that mention `$TUNA`

### 6. UPDATE: `colosseum-forum` and `colosseum-auto-engage`
- Replace all `tuna.fun` links with `clawmode.fun`
- Update metric strings that reference `tuna.fun/t/TUNA`

### 7. SKIP (low priority): CLI and smart contracts
- `cli/` and `contracts/` are external developer tools — these can be updated in a separate pass

### 8. SKIP (intentional): Bot blocklists
- The `buildtuna`, `tunalaunch` etc. entries in the scan blocklist should stay — they prevent the bot replying to old accounts

---

## Files to Modify (Summary)

| File | Action |
|---|---|
| `supabase/functions/agent-hourly-post/index.ts` | Rewrite tweet template OR disable cron |
| `supabase/functions/agent-process-post/index.ts` | Replace `tuna.fun` → `clawmode.fun` (6+ spots) |
| `supabase/functions/agent-launch/index.ts` | Replace `tuna.fun` → `clawmode.fun` + fix "Trade on TUNA" label |
| `supabase/functions/pump-agent-launch/index.ts` | Replace `tuna.fun` + `BuildTuna` Twitter |
| `supabase/functions/twitter-mention-launcher/index.ts` | Replace `tuna.fun` |
| `supabase/functions/trading-agent-create/index.ts` | Replace `tuna.fun` |
| `supabase/functions/admin-check-agent-balance/index.ts` | Replace `tuna.fun` (2 spots) |
| `supabase/functions/agent-register/index.ts` | Replace `tuna.fun` dashboard URL |
| `supabase/functions/agent-claim-verify/index.ts` | Replace `tuna.fun` dashboard URL |
| `supabase/functions/colosseum-forum/index.ts` | Replace all `tuna.fun` links |
| `supabase/functions/colosseum-auto-engage/index.ts` | Replace metric strings |
| `supabase/functions/api-launch-token/index.ts` | Replace `BuildTuna` Twitter default |
| `supabase/functions/agent-auto-engage/index.ts` | Update SystemTUNA persona |
| `supabase/functions/test-twitterapi-reply/index.ts` | Update test tweet text |
| `src/components/launchpad/TunaPulse.tsx` | Rename component + UI text |
| `src/components/agents/AgentPlatformToken.tsx` | Update $TUNA references |
| `src/components/LaunchCountdown.tsx` | Update "$TUNA launches" text |
| `src/pages/WhitepaperPage.tsx` | Update "$TUNA Token" label |
| `api/pool/create-phantom.ts` | Replace `tuna.fun` fallback URL |
