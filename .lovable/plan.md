

# Plan: Rebrand All Legacy Names to Saturn + Create Branding Config

## Scope

Rename all user-facing legacy brand names (`claw`, `tuna`, `opentuna`, `openclaw`, `clawmode`, `clawbook`, `clawsai`) to Saturn equivalents across the entire codebase, and create a centralized branding config file.

**Important constraint**: Database table names (`claw_agents`, `subtuna`, etc.) and edge function directory names CANNOT be renamed without breaking deployed infrastructure. Only the code that *references* them (variable names, display text, file names) will be updated. The DB queries will still reference the same table names.

## What changes

### 1. Create branding config: `src/config/branding.ts`
Single source of truth for all display-facing brand strings:
- `brandName`: "Saturn Trade"
- `brandShortName`: "Saturn"
- `tagline`, `domain`, `twitterHandle`, `logoPath`, social links
- `forumName`: "Saturn Forum" (was ClawBook)
- `communityName`: "Saturn Community" (was SubClaw/SubTuna)
- Legacy CSS class prefix mappings for reference

### 2. Rename source files (~45 files)

**Components** — rename files + exports + imports:
- `src/components/claw/` → `src/components/saturn/` (10 files: ClawHero→SaturnHero, ClawStatsBar→SaturnStatsBar, etc.)
- `src/components/clawbook/` → `src/components/forum/` (19 files: ClawBookLayout→ForumLayout, ClawPostCard→ForumPostCard, ClawVoteButtons→ForumVoteButtons, etc.)

**Hooks** — rename files + exports + imports:
- `useClawAdminLaunch` → `useSaturnAdminLaunch`
- `useClawAgentBid` → `useSaturnAgentBid`
- `useClawBidCountdown` → `useSaturnBidCountdown`
- `useClawBribe` → `useSaturnBribe`
- `useClawCommunities` → `useSaturnCommunities`
- `useClawIdeaGenerate` → `useSaturnIdeaGenerate`
- `useClawSDK` → `useSaturnSDK`
- `useClawStats` → `useSaturnStats`
- `useClawTokenData` → `useSaturnTokenData`
- `useClawTokens` → `useSaturnTokens`
- `useClawTradingAgents` → `useSaturnTradingAgents`
- `useSubTuna` → `useSaturnForum`
- `useSubTunaComments` → `useSaturnComments`
- `useSubTunaMembership` → `useSaturnMembership`
- `useSubTunaPosts` → `useSaturnPosts`
- `useSubTunaRealtime` → `useSaturnRealtime`
- `useSubTunaReports` → `useSaturnReports`

**Pages** — rename files + exports + routes:
- `ClawModePage` → `SaturnModePage`
- `ClawBookPage` → `SaturnForumPage`
- `ClawBookAdminPage` → `SaturnForumAdminPage`
- `ClawPostPage` → `SaturnPostPage`
- `ClawAdminLaunchPage` → `SaturnAdminLaunchPage`
- `SubClawPage` → `SaturnCommunityPage`

**Config**: `src/config/claw-character.ts` → `src/config/saturn-character.ts`

**Styles**: 
- `src/styles/claw-theme.css` → `src/styles/saturn-theme.css` (rename CSS class prefix `.claw-` → `.saturn-`, CSS vars `--claw-` → `--saturn-`)
- `src/styles/clawbook-theme.css` → `src/styles/forum-theme.css` (rename `.clawbook-` → `.forum-`, `--clawbook-` → `--forum-`)

### 3. Update all imports and references (~40+ consuming files)
- `App.tsx` — update lazy imports and route paths
- `AdminPanelPage.tsx` — update lazy imports for admin tabs
- All pages/components that import from renamed files
- All CSS class name references in TSX files (e.g., `clawbook-theme` → `forum-theme`, `claw-theme` → `saturn-theme`)

### 4. Update edge function display text (not directory names)
- Inside edge function code: rename user-facing strings like "Claw Mode" → "Saturn", log prefixes, error messages
- `CLAW_CONCEPTS` array in `agent-idea-generate` → `SATURN_CONCEPTS`
- CLI config (`cli/src/config.ts`): `.claw` dir → `.saturn`, `ClawConfig` → `SaturnConfig`
- CLI bin (`cli/src/bin/opentuna.ts`): command name `claw` → `saturn`, banner text

### 5. SDK/Public files
- `public/sdk/package.json`: `@openclaw/sdk` → `@saturntrade/sdk`
- SDK source files in `sdk/src/` (if they exist beyond package.json)

### 6. Fix existing build errors
- Address the 3 build failures (likely transient or from missing assets from prior edits)

## What stays the same (no breakage risk)
- Database table names: `claw_agents`, `claw_tokens`, `subtuna`, `subtuna_posts`, etc. — queries reference these unchanged
- Edge function directory names: `claw-tokens/`, `opentuna-agent-hatch/`, etc. — these are deployed endpoints
- `supabase/config.toml` — never edited

## Execution order
1. Create `src/config/branding.ts`
2. Rename CSS files + update class/var prefixes
3. Rename hook files + update exports/imports
4. Rename component files + update exports/imports  
5. Rename page files + update exports/imports
6. Update `App.tsx` routes and lazy imports
7. Update `AdminPanelPage.tsx` admin tab imports
8. Update CLI and SDK references
9. Update edge function display strings
10. Fix any build errors

This is a ~100+ file change across the entire codebase. All database queries will continue to work since table names are unchanged — only TypeScript/CSS file names, class names, variable names, and display text are renamed.

