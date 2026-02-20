

# Complete TUNA-to-CLAW Purge + Remove Claims Page

## Summary
Final comprehensive pass to eliminate every remaining user-visible "TUNA" reference across ~60 frontend files and ~65 edge function files, plus fully remove the `/agents/claim` page and all links to it. Database column names (`subtuna_id`, `subtuna_ticker`) and table names (`subtuna`, `subtuna_posts`, `opentuna_*`) are intentionally preserved.

---

## Part 1: Remove the Agent Claim Page

### Delete
- **`src/pages/AgentClaimPage.tsx`** -- remove the entire file

### Update Route
- **`src/App.tsx`** -- remove the `AgentClaimPage` lazy import and the `/agents/claim` route

### Remove All Links to `/agents/claim`
| File | What to Remove/Change |
|------|----------------------|
| `src/pages/AgentDocsPage.tsx` | Remove all `/agents/claim` links and the "Go to Claim Dashboard" button (~5 references). Replace claim instructions with "Go to your Panel to manage earnings" pointing to `/panel` |
| `src/pages/WhitepaperPage.tsx` | Change `/agents/claim` reference to `/panel` |
| `src/pages/ClawBookPage.tsx` | Remove "Claim your agent" link or change to `/panel` |
| `src/components/agents/AgentHero.tsx` | Update claim link to `/panel` (already partially done but references remain) |

---

## Part 2: User-Visible Text Replacements (Frontend)

### Pages

| File | Changes |
|------|---------|
| `AgentClaimPage.tsx` | DELETED (Part 1) |
| `AgentDocsPage.tsx` | "What Are TUNA Agents?" heading, "TUNA treasury" and "TUNA covers all on-chain costs" in FAQ answers |
| `AgentProfilePage.tsx` | Comment "SubTunas directly linked to agent (for system agent like t/TUNA)" -- update comment |
| `SubClawPage.tsx` | `ticker === "TUNA"` check for system community -- change to `"CLAW"` |
| `TokenDetailPage.tsx` | Share text "Check out ... on TUNA!" -- change to "on Claw Mode!" |
| `FunTokenDetailPage.tsx` | Same share text fix |
| `AgentDashboardPage.tsx` | localStorage key `tuna_agent_api_key` -- change to `claw_agent_api_key` |
| `TreasuryAdminPage.tsx` | Passwords `tuna-treasury-2024` / `tuna2024treasury` -- change to `claw-treasury-2024` / `claw2024treasury` |
| `DeployerDustAdminPage.tsx` | Password `tuna2024treasury` -- change to `claw2024treasury` |
| `CompressedDistributePage.tsx` | Admin password `"tuna"` -- change to `"claw"` |
| `FollowerScanPage.tsx` | Admin password `"tuna"` -- change to `"claw"` |
| `ClawAdminLaunchPage.tsx` | Admin password `"tuna"` -- change to `"claw"` |
| `PartnerFeesPage.tsx` | Default launchpad type `"tuna"` -- change to `"claw"` |
| `TradingAgentsPage.tsx` | "SubTuna community" references |
| `AgentConnectPage.tsx` | Any remaining "SubTuna" text |

### Components

| File | Changes |
|------|---------|
| `admin/BaseDeployPanel.tsx` | "TunaFactory" / "TunaToken" labels in deploy UI -- change to "ClawFactory" / "ClawToken" |
| `launchpad/MemeLoadingAnimation.tsx` | `TUNA_LOGO_SRC` constant name -- rename to `CLAW_LOGO_SRC` |
| `launchpad/StatsCards.tsx` | "in subtuna" label -- change to "in communities" |
| `claw/ClawSDKDocs.tsx` | Any remaining "SubTuna" labels |
| `claw/ClawSDKIntegrations.tsx` | Any remaining "SubTuna" |
| `clawbook/ClawPostCard.tsx` | Prop names `subtuna` are internal/mapped to DB -- keep as-is (not user-visible) |
| `clawbook/TokenStatsHeader.tsx` | Interface `Subtuna`, prop `subtuna`, type `TunaPostCardProps` -- rename to `Community`, `community`, `ClawPostCardProps` |
| `DomainRouter.tsx` | Comment update only |

### Hooks

| File | Changes |
|------|---------|
| `useSubTuna.ts` | `ticker === "TUNA"` checks -- change to `"CLAW"` |
| `useBaseContractDeploy.ts` | Interface property names `TunaFactory` / `TunaToken` -- rename to `ClawFactory` / `ClawToken` |

### Providers

| File | Changes |
|------|---------|
| `EvmWalletProvider.tsx` | `appName: 'TUNA Launchpad'` and `projectId: 'tuna-launchpad-base'` -- change to `'Claw Mode'` and `'claw-launchpad-base'` |

### Lib

| File | Changes |
|------|---------|
| `lib/baseContracts.ts` | Rename all exported constants: `TUNA_POSITION_MANAGER_ABI` to `CLAW_POSITION_MANAGER_ABI`, `TUNA_FLAUNCH_ABI` to `CLAW_FLAUNCH_ABI`, `TUNA_BID_WALL_ABI` to `CLAW_BID_WALL_ABI`, `TUNA_FAIR_LAUNCH_ABI` to `CLAW_FAIR_LAUNCH_ABI`, `TUNA_FLETH_ABI` to `CLAW_FLETH_ABI`, `TUNA_FACTORY` to `CLAW_FACTORY`, `TUNA_TOKEN_IMPL` to `CLAW_TOKEN_IMPL`, `TUNA_FACTORY_ABI` to `CLAW_FACTORY_ABI`, `TUNA_TOKEN_ABI` to `CLAW_TOKEN_ABI`, `TUNA_LAUNCHPAD_ABI` to `CLAW_LAUNCHPAD_ABI`. Update all imports across the codebase. |
| `lib/agentAvatars.ts` | `SYSTEM_TUNA_ID` -- rename to `SYSTEM_CLAW_ID` and update all imports |

### Tests

| File | Changes |
|------|---------|
| `src/test/opentuna.test.tsx` | "OpenTuna" in test names -- change to "Claw SDK" |

---

## Part 3: Public Documentation

| File | Changes |
|------|---------|
| `public/skill.md` | `"subtuna"` API param references -- change labels to "community" in descriptions |
| `public/TUNA_WHITEPAPER.md` | Full rebrand: rename file content, replace all "TUNA" / "OpenTuna" / "SubTuna" / `!tunalaunch` / "SystemTUNA" / `@BuildTuna` references. Keep filename as-is (URL may be bookmarked) but update all content |
| `public/sdk/src/index.ts` | `subtunaId` param name (maps to API) -- keep but update JSDoc descriptions |
| `public/sdk/examples/social-engagement.ts` | Update any "SubTuna" text |

---

## Part 4: Edge Functions (User-Visible Text Only)

| File | Changes |
|------|---------|
| `agent-scan-twitter/index.ts` | Remove "buildtuna", "tunalaunch", "tunabot", "tuna_launch", "build_tuna", "tunaagent" from bot blocklist (keep only claw variants). Change "is now live on TUNA!" bot reply filter string to "is now live on Claw!" |
| `agent-process-post/index.ts` | `"TUNA_NO_WALLET_"` prefix -- change to `"CLAW_NO_WALLET_"`. Log messages referencing "SubTuna" -- update |
| `promote-post/index.ts` | Tweet text `#TUNA` hashtag -- change to `#ClawMode` |
| `admin-check-agent-balance/index.ts` | Log messages referencing "postToSubTuna" -- update function name in logs only (keep DB queries as-is) |
| `opentuna-fin-trade/index.ts` | Default encryption key string `"opentuna-default-key..."` -- update to `"openclaw-default-key..."` |
| `tuna-snapshot/index.ts` | This is migration-specific legacy code -- keep as-is |
| `verify-tuna-migration/index.ts` | Migration-specific legacy code -- keep as-is |

Note: All `.from("subtuna")`, `.from("subtuna_posts")`, `.from("opentuna_*")` database queries are preserved. Only user-visible strings, log labels, and comments are updated.

---

## What Will NOT Change

- Database table names and column names (`subtuna`, `subtuna_posts`, `subtuna_id`, `opentuna_*`)
- Supabase query `.from()` calls
- Edge function folder names (`opentuna-*`, `tuna-snapshot`, `verify-tuna-migration`)
- Internal variable names that directly map to DB columns (e.g., `subtuna_ticker` in `useXBotAccounts.ts`)
- Migration-specific code (`tuna-snapshot`, `verify-tuna-migration`)
- CLI source files under `cli/`

---

## Execution Order

1. Remove AgentClaimPage and its route/imports
2. Update all links from `/agents/claim` to `/panel`
3. Rename constants in `lib/baseContracts.ts` and `lib/agentAvatars.ts`, then update all imports
4. Bulk text replacements across pages, components, hooks, and providers
5. Update public documentation files
6. Update edge function user-visible strings
7. Redeploy affected edge functions

