

# Purge All Legacy TUNA Branding

## Summary
A comprehensive find-and-replace across all pages, components, hooks, and public documentation to eliminate every user-visible reference to "TUNA", "SubTuna", "OpenTuna", "BuildTuna", "tunalaunch", and "tuna.fun" -- replacing them with Claw Mode equivalents.

**Important**: Database table names (opentuna_*, subtuna_*) and edge function folder names are intentionally preserved for infrastructure stability. Only user-facing text, labels, URLs, and documentation are updated.

---

## Files to Change

### Pages (src/pages/)

| File | What's Wrong | Fix |
|------|-------------|-----|
| `AgentConnectPage.tsx` | "SubTuna" mentioned ~10 times, example uses `"TUNA"` ticker, `tuna.fun` in prompt URLs | Replace "SubTuna" with "Claw Communities", fix example ticker, update URLs to `clawmode.fun` |
| `AgentDocsPage.tsx` | `!tunalaunch` command, tweet intent URL uses `@ClawMode !tunalaunch` | Change to `!clawmode` command |
| `AgentClaimPage.tsx` | `!tunalaunch` command references, `@ClawMode` with wrong command | Update to `!clawmode` |
| `AgentLogsAdminPage.tsx` | Card title says "Recent !tunalaunch Mentions" | Change to "Recent !clawmode Mentions" |
| `ApiDocsPage.tsx` | Class names `TunaLaunchpadAPI` and `TunaLaunchpad` in code examples | Rename to `ClawLaunchpadAPI` / `ClawLaunchpad` |
| `ApiDashboardPage.tsx` | Link to `x.com/buildtuna` | Change to `x.com/clawmode` |
| `ClaudeLauncherPage.tsx` | Two Dune links to `dune.com/tunalaunch/stats` | Update to `dune.com/clawmode/stats` or remove |
| `TreasuryAdminPage.tsx` | `tunalaunch.vercel.app` URL, passwords `tuna-treasury-2024` and `tuna2024treasury` | Update URL to `clawmode.vercel.app`, passwords to `claw2024treasury` |
| `DeployerDustAdminPage.tsx` | Password `tuna2024treasury` | Change to `claw2024treasury` |
| `TradingAgentsPage.tsx` | "SubTuna community" and "SubTuna" in step descriptions | Change to "Claw community" |
| `WhitepaperPage.tsx` | Section ID `opentuna` in nav and anchor | Change to `claw-sdk` |
| `ClawBookPage.tsx` | Tab value `"tuna"` used internally | Change to `"claw"` |
| `SubClawPage.tsx` | Checks `ticker === "TUNA"` for system community | Change to `"CLAW"` |
| `CompressedDistributePage.tsx` | Admin password `"tuna"` | Change to `"claw"` |
| `FollowerScanPage.tsx` | Admin password `"tuna"` | Change to `"claw"` |
| `ClawAdminLaunchPage.tsx` | Admin password `"tuna"` | Change to `"claw"` |
| `PartnerFeesPage.tsx` | Default launchpad type `"tuna"` | Change to `"claw"` |
| `ClawPostPage.tsx` | No user-visible text issues (DB queries use subtuna_ tables -- kept) | No change needed for DB refs |

### Components (src/components/)

| File | What's Wrong | Fix |
|------|-------------|-----|
| `claw/ClawSDKDocs.tsx` | "SubTuna" label ~8 times, `tunanet` API references in code examples, `pump.fun` mention | Replace "SubTuna" with "Claw Communities", `tunanet` with `clawnet`, remove pump.fun |
| `claw/ClawSDKIntegrations.tsx` | Integration named "SubTuna" | Rename to "Claw Social" |
| `layout/Footer.tsx` | Link points to `/opentuna` | Change to `/sdk` |
| `DomainRouter.tsx` | Comment says "os.clawmode.fun -> /opentuna" | Update comment to `/sdk` |

### Hooks (src/hooks/)

| File | What's Wrong | Fix |
|------|-------------|-----|
| `useSubTuna.ts` | Checks `ticker === "TUNA"`, labels show "TUNA" | Change to "CLAW" |
| `useXBotAccounts.ts` | Field name `subtuna_ticker` -- DB column, keep as-is | No change (DB field) |

### Tests

| File | What's Wrong | Fix |
|------|-------------|-----|
| `src/test/opentuna.test.tsx` | "OpenTuna" in test names and mock labels | Change to "Claw SDK" |

### Public Documentation

| File | What's Wrong | Fix |
|------|-------------|-----|
| `public/rules.md` | "TUNA Agent Community Rules", "SubTuna" throughout | Full rebrand to "Claw" |
| `public/heartbeat.md` | "TUNA Agent Heartbeat Protocol", "SubTuna" | Full rebrand to "Claw" |
| `public/skill.md` | Entire file: "tuna-subtuna", "TUNA", `@BuildTuna`, `!tunalaunch`, `tuna.fun` URLs ~20 times | Full rebrand: `@clawmode`, `!clawmode`, `clawmode.fun` |
| `public/skill.json` | `"tuna-subtuna"` name, "SubTuna" descriptions | Rebrand to "claw" |
| `public/sdk/package.json` | GitHub URLs `buildtuna/tuna-agent-sdk` | Change to `openclaw/claw-agent-sdk` |
| `public/sdk/README.md` | "SubTuna Communities" label | Change to "Claw Communities" |
| `public/sdk/src/index.ts` | `TunaAgent` class, `TunaConfig` interface, `tna_live_` prefix | Rename to `ClawAgent`, `ClawConfig`, `oca_live_` |
| `public/sdk/LICENSE` | Copyright says "TUNA" | Change to "Claw Mode" |
| `public/TUNA_WHITEPAPER.md` | Entire filename and content is TUNA branded | Full rebrand to Claw |

### App Router

| File | What's Wrong | Fix |
|------|-------------|-----|
| `src/App.tsx` | Route `/opentuna` redirect (already redirects to `/sdk` -- functional but legacy path name visible in code) | Keep redirect for backwards compat, just update comment |

---

## What Will NOT Change (by design)

- Database table names: `opentuna_agents`, `opentuna_dna`, `opentuna_fins`, `subtuna_posts`, `subtuna_reports`, etc.
- Edge function folder names: `opentuna-dna-update`, `opentuna-api-key-create`, etc.
- Supabase query `.from("opentuna_*")` and `.from("subtuna_*")` calls
- CLI source files under `cli/` (separate package)
- Internal variable names that map to DB columns (e.g., `subtuna_id`)

---

## Branding Reference

| Old | New |
|-----|-----|
| TUNA | CLAW |
| SubTuna | Claw Communities |
| OpenTuna | Claw SDK |
| BuildTuna / @BuildTuna | @clawmode |
| !tunalaunch | !clawmode |
| tuna.fun | clawmode.fun |
| TunaAgent / TunaConfig | ClawAgent / ClawConfig |
| tna_live_ | oca_live_ |
| tunanet | clawnet |
| tuna2024treasury | claw2024treasury |

