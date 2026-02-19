
## Replace All @buildtuna → @clawmode (Full Execution)

### What's left to change

The previous plan covered 13 frontend files and 6 edge functions. Below is the exact, file-by-file breakdown of every remaining occurrence.

---

### Frontend — 8 files

**`src/components/layout/AppHeader.tsx`**
- Line 68: `x.com/buildtuna` → `x.com/clawmode`

**`src/components/layout/Footer.tsx`**
- Line 69: `x.com/buildtuna` → `x.com/clawmode`
- Line 75: `t.me/buildtuna` → `t.me/clawmode`

**`src/components/agents/AgentIdeaGenerator.tsx`**
- Line 368: `@BuildTuna` → `@ClawMode` (in the tweet code preview)

**`src/components/launchpad/PromoteModal.tsx`**
- Line 74: `twitter.com/buildtuna/status/` → `twitter.com/clawmode/status/`

**`src/components/admin/XBotRulesForm.tsx`**
- Line 25: `"@buildtuna"` → `"@clawmode"` in DEFAULT_MENTIONS array
- Line 27: `"buildtuna"` → `"clawmode"` in SUGGESTED_KEYWORDS array

**`src/pages/AgentDocsPage.tsx`**
- Line 385: `@BuildTuna !tunalaunch` → `@ClawMode !tunalaunch` (code block)
- Line 397: `@BuildTuna` → `@ClawMode` (description text)
- Line 999: `@BuildTuna` → `@ClawMode` (FAQ answer)
- Line 1086: tweet intent URL `@BuildTuna` → `@ClawMode`

**`src/pages/AgentClaimPage.tsx`**
- Line 535: `@BuildTuna` → `@ClawMode` (card description)
- Line 644: `@BuildTuna` → `@ClawMode` (empty state text)

**`src/pages/CareersPage.tsx`**
- Line 189: recipient_id `buildtuna` → `clawmode`
- Line 433: `DM @buildtuna on X` → `DM @clawmode on X`

**`src/pages/WhitepaperPage.tsx`**
- Line 1087: `x.com/BuildTuna` → `x.com/clawmode`

**`src/pages/ClaudeLauncherPage.tsx`**
- Line 1020: `x.com/buildtuna` → `x.com/clawmode`
- Line 1058: `x.com/buildtuna` → `x.com/clawmode`

**`src/pages/BagsAgentsPage.tsx`**
- Line 55: default twitter value `x.com/BuildTuna` → `x.com/clawmode`
- Line 336: placeholder `x.com/BuildTuna` → `x.com/clawmode`

---

### Edge Functions — 6 files

**`supabase/functions/twitter-auto-reply/index.ts`**
- Line 456: log string `@buildtuna tweets` → `@clawmode tweets`
- Line 458: `to:buildtuna` query → `to:clawmode`
- Line 470: log string `to @buildtuna` → `to @clawmode`
- Line 475: self-filter `!== "buildtuna"` → `!== "clawmode"`
- Line 491: `searchQuery = "to:buildtuna (replies)"` → `"to:clawmode (replies)"`
- Line 535: self-filter `!== "buildtuna"` → `!== "clawmode"`

**`supabase/functions/promo-mention-reply/index.ts`**
- Line 19: `"buildtuna"` in BOT_USERNAMES Set → `"clawmode"`
- Line 113: search query `@buildtuna` → `@clawmode`
- Line 283: return type `"buildtuna"` → `"clawmode"`
- Line 286: `includes("@buildtuna")` → `includes("@clawmode")`
- Line 294: `return "buildtuna"` → `return "clawmode"`

**`supabase/functions/promo-mention-scan/index.ts`**
- Line 13: `"buildtuna"` in BOT_USERNAMES → `"clawmode"`
- Line 53: search query `@buildtuna` → `@clawmode`
- Line 101: `includes("@buildtuna")` → `includes("@clawmode")`
- Line 109: `return "buildtuna"` → `return "clawmode"`

**`supabase/functions/agent-idea-generate/index.ts`**
- Line 82: prompt `@buildtuna mention` → `@clawmode mention`
- Line 119: fallback tweetText `@buildtuna` → `@clawmode`
- Line 186: fallback tweetText `@buildtuna` → `@clawmode`

**`supabase/functions/agent-hourly-post/index.ts`**
- Line 317: `twitter.com/buildtuna/status/` → `twitter.com/clawmode/status/`

**`supabase/functions/promote-post/index.ts`**
- Line 275: `twitter.com/buildtuna/status/` → `twitter.com/clawmode/status/`

**`supabase/functions/bags-agent-launch/index.ts`**
- Line 109: fallback `x.com/BuildTuna` → `x.com/clawmode`

---

### What is intentionally NOT changed

| Item | Reason |
|---|---|
| `supabase/migrations/` SQL files | Migration history is immutable — can't rewrite past migrations |
| `supabase/functions/test-proxy/index.ts` line 90 | This is a health-check that looks up the username on Twitter API — needs to match the live account name. Will update to `clawmode`. |
| `supabase/functions/test-community/index.ts` lines 200–219 | Admin debug tool that checks community membership. Will update the variable name and username string. |
| `supabase/functions/colosseum-submit/index.ts` lines 144, 195 | GitHub repo link and team twitter — will update to `clawmode`. |
| `src/pages/PromoMentionsAdminPage.tsx` line 264 | Display-only code snippet showing search query. Will update to `@clawmode`. |

---

### Technical Notes

- Edge functions redeploy automatically on file save — no manual deploy needed
- The `determineMentionType` return type strings (`"buildtuna"`) are string literals used as internal event types. These also need updating to `"clawmode"` so downstream logic handles them correctly
- All changes are pure string replacements — zero logic changes
- Total: ~15 frontend files + 8 edge function files
