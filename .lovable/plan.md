

# Complete "Tuna" to "Claw" Rebranding Across All Files

## Overview
There are approximately **4,500+ references** to "tuna" across **~100 files** in the frontend (`src/`), CLI (`cli/`), and edge functions (`supabase/functions/`). This plan covers every single one, organized by category.

**Important constraint**: Database table names (`subtuna`, `subtuna_posts`, `subtuna_comments`, `opentuna_agents`, `opentuna_dna`, etc.) and edge function folder names stay unchanged to maintain infrastructure stability. Only user-facing text, component names, CSS classes, file names, and variable names change.

---

## Category 1: File/Directory Renames

### Components directory
- `src/components/tunabook/` --> `src/components/clawbook/`
  - All 19 files inside keep their names but internal references update

### Hooks
- `src/hooks/useTunaTokenData.ts` --> `src/hooks/useClawTokenData.ts`
- `src/hooks/useSubTuna.ts` --> stays (queries DB table `subtuna`)
- `src/hooks/useSubTunaComments.ts` --> stays
- `src/hooks/useSubTunaMembership.ts` --> stays
- `src/hooks/useSubTunaPosts.ts` --> stays
- `src/hooks/useSubTunaRealtime.ts` --> stays
- `src/hooks/useSubTunaReports.ts` --> stays

Note: Hook files that directly reference DB table names (`subtuna`) keep their filenames since the tables remain, but exported function names and internal user-facing strings will be updated.

### Pages
- `src/pages/TunaBookPage.tsx` --> `src/pages/ClawBookPage.tsx`
- `src/pages/TunaBookAdminPage.tsx` --> `src/pages/ClawBookAdminPage.tsx`
- `src/pages/TunaPostPage.tsx` --> `src/pages/ClawPostPage.tsx`
- `src/pages/SubTunaPage.tsx` --> `src/pages/SubClawPage.tsx`

### Styles
- `src/styles/tunabook-theme.css` --> `src/styles/clawbook-theme.css`

---

## Category 2: CSS Variable & Class Renames (tunabook-theme.css)

All CSS variables and class names change prefix:
- `--tunabook-*` --> `--clawbook-*` (every single variable, ~60+)
- `.tunabook-theme` --> `.clawbook-theme`
- `.tunabook-card` --> `.clawbook-card`
- `.tunabook-stats-banner` --> `.clawbook-stats-banner`
- `.tunabook-stat-*` --> `.clawbook-stat-*`
- `.tunabook-search-*` --> `.clawbook-search-*`
- `.tunabook-vote-*` --> `.clawbook-vote-*`
- `.tunabook-community-link` --> `.clawbook-community-link`
- `.tunabook-sidebar` --> `.clawbook-sidebar`
- `.tunabook-banner` --> `.clawbook-banner`
- `.tunabook-pinned` --> `.clawbook-pinned`
- All other `.tunabook-*` classes

Every file referencing these classes (pages, components) updates accordingly.

---

## Category 3: Component Internal Changes

### All 19 files in `src/components/tunabook/` (moving to `clawbook/`)
- Update all `tunabook-*` CSS class references to `clawbook-*`
- Update all `--tunabook-*` CSS variable references to `--clawbook-*`
- Rename exported components where applicable:
  - `TunaPostCard` --> `ClawPostCard`
  - `TunaBookLayout` --> `ClawBookLayout`
  - `TunaBookFeed` --> `ClawBookFeed`
  - `TunaBookSidebar` --> `ClawBookSidebar`
  - `TunaBookRightSidebar` --> `ClawBookRightSidebar`
  - `TunaCommentTree` --> `ClawCommentTree`
  - `TunaVoteButtons` --> `ClawVoteButtons`
  - `SubTunaCard` --> `SubClawCard`
- Update interface names: `TunaPostCardProps` --> `ClawPostCardProps`, etc.
- Update all `subtuna` in user-facing text to "SubClaw" (but keep DB query references as `subtuna`)

---

## Category 4: Page-Level Changes

### src/pages/SubTunaPage.tsx (renamed to SubClawPage.tsx)
- Update all imports from `tunabook/` to `clawbook/`
- Update CSS theme import from `tunabook-theme.css` to `clawbook-theme.css`
- Update all `tunabook-*` class names to `clawbook-*`
- Rename `isTunaPage` --> `isClawPage`, `tunaLiveData` --> `clawLiveData`
- User-facing text: "SubTuna" --> "SubClaw", "TunaBook" --> "ClawBook"

### src/pages/TunaBookPage.tsx (renamed to ClawBookPage.tsx)
- Same pattern: imports, CSS classes, component references, user-facing text

### src/pages/TunaPostPage.tsx (renamed to ClawPostPage.tsx)
- Same pattern

### src/pages/TunaBookAdminPage.tsx (renamed to ClawBookAdminPage.tsx)
- Same pattern

### src/pages/AgentProfilePage.tsx
- Update imports from `tunabook/` to `clawbook/`
- Update `tunabook-theme.css` --> `clawbook-theme.css`
- Update CSS class references
- "Back to TunaBook" --> "Back to ClawBook"

### src/pages/AgentDocsPage.tsx
- "Social Features (TunaBook)" --> "Social Features (ClawBook)"

### src/pages/TradingAgentProfilePage.tsx
- `/tunabook/post/` --> `/clawbook/post/` in link

### src/pages/GovernancePage.tsx
- "TUNA Governance AI" --> "Claw Governance AI"

### src/pages/LaunchpadTemplatePage.tsx
- "Powered by TUNA" --> "Powered by Claw Mode"

### src/pages/CareersPage.tsx
- "OpenTuna SDK" --> "Claw SDK"

### src/pages/TunnelDistributePage.tsx
- Admin password `"tuna"` --> `"claw"` (or leave as internal)

### src/pages/ApiDocsPage.tsx (the page user is on)
- All 61 references: "TUNA Launchpad API", "TUNA API", `TunaLaunchpadAPI`, `TunaLaunchpad`, variable names `tuna`, user-facing strings
- --> "Claw Mode API", `ClawLaunchpadAPI`, `ClawLaunchpad`, variable `claw`

---

## Category 5: Hook & Utility Changes

### src/hooks/useTunaTokenData.ts --> useClawTokenData.ts
- `TUNA_TOKEN_CA` --> `CLAW_TOKEN_CA`
- `TunaTokenData` --> `ClawTokenData`
- `useTunaTokenData` --> `useClawTokenData`
- Query key: `"tuna-token-data"` --> `"claw-token-data"`
- Error message: "Failed to fetch TUNA token data" --> "Failed to fetch CLAW token data"

### src/hooks/useSubTuna.ts
- Keep filename (queries `subtuna` table)
- Internal user-facing text: "TUNA" --> "CLAW" where shown to users
- `isTunaSubtuna` --> `isClawSubtuna`

### src/contexts/ChainContext.tsx
- `STORAGE_KEY = 'tuna-selected-chain'` --> `'claw-selected-chain'`

### src/lib/debugLogger.ts
- `STORAGE_KEY = 'tuna_debug_logs'` --> `'claw_debug_logs'`
- `SESSION_KEY = 'tuna_debug_session'` --> `'claw_debug_session'`

---

## Category 6: Widget Components

### src/components/widgets/TradePanelWidget.tsx
- "Powered by TUNA Launchpad" --> "Powered by Claw Mode"

### src/components/widgets/TokenListWidget.tsx
- "Powered by TUNA Launchpad" --> "Powered by Claw Mode"

### src/components/widgets/TokenLauncherWidget.tsx
- "Powered by TUNA Launchpad" --> "Powered by Claw Mode"

---

## Category 7: Launchpad Components

### src/components/launchpad/TokenCard.tsx, KingOfTheHill.tsx, JustLaunched.tsx, TokenTable.tsx
- Update imports from `@/components/tunabook/` to `@/components/clawbook/`

---

## Category 8: App.tsx Router

- Update lazy imports for renamed pages
- Update any route paths if they contain "tunabook" or "tuna"

---

## Category 9: Edge Functions (user-facing text only)

### supabase/functions/ai-chat/index.ts
- "TUNA Governance AI" --> "Claw Governance AI"
- "TUNA platform" --> "Claw Mode platform"

### supabase/functions/pump-claim-fees/index.ts
- Comment: "matches TUNA agents" --> "matches Claw agents"

### supabase/functions/agent-social-comment/index.ts
- URL: `clawmode.fun/tunabook/post/` --> `clawmode.fun/post/`

### supabase/functions/base-create-token/index.ts
- Contract name `TunaToken` --> `ClawToken` (Solidity source)

Note: DB table references (`subtuna_posts`, `subtuna_comments`, `opentuna_agents`, etc.) stay unchanged in all edge functions.

---

## Category 10: CLI (cli/src/)

All 12 CLI files update user-facing strings:
- "OpenTuna" --> "Claw" throughout
- `OpenTunaConfig` interface name --> `ClawConfig`
- Config directory `~/.opentuna/` --> `~/.claw/`
- `projectName: 'opentuna'` --> `projectName: 'claw'`
- `OPENTUNA_API_KEY` env var --> `CLAW_API_KEY`
- `OPENTUNA_BASE_URL` --> `CLAW_BASE_URL`
- All CLI help text and error messages
- "opentuna init", "opentuna fund", etc. --> "claw init", "claw fund", etc.

---

## What Will NOT Change
- Database table names (subtuna, subtuna_posts, subtuna_comments, opentuna_agents, opentuna_dna, etc.)
- Edge function folder names (opentuna-hatch, opentuna-dna-update, etc.)
- Supabase queries referencing `.from("subtuna")`, `.from("opentuna_agents")`, etc.
- Desktop layout, colors, fonts, structure
- Any mobile responsiveness fixes already applied

## Estimated Scope
- ~100 files modified
- ~4,500+ string replacements
- 4 file renames (pages) + 1 directory rename (components) + 1 hook rename + 1 CSS rename
- Zero database or infrastructure changes

