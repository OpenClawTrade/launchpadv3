

# Rename All OpenTuna References to Claw SDK

## Scope
Every file in the project that references "OpenTuna", "opentuna", "@opentuna", or "ota_live_" will be renamed to use "Claw SDK" / "ClawSDK" / "@openclaw" / "oca_live_" branding. This covers **60+ files** across frontend, hooks, edge functions, SDK, CLI, CSS, and documentation.

## Naming Convention

| Old | New |
|-----|-----|
| `OpenTuna` (class/type) | `ClawSDK` |
| `opentuna` (css/query keys) | `clawsdk` |
| `OpenTunaPage` | `ClawSDKPage` |
| `OpenTunaProvider` | `ClawSDKProvider` |
| `useOpenTuna*` | `useClawSDK*` / `useClawAgent*` |
| `@opentuna/sdk` | `@openclaw/sdk` |
| `@opentuna/cli` | `@openclaw/cli` |
| `ota_live_` | `oca_live_` |
| `.opentuna-card` | `.clawsdk-card` |
| `opentuna_agents` (DB table refs) | kept as-is (DB tables unchanged) |
| Display text "OpenTuna" | "Claw SDK" |

**Important**: Database table names (`opentuna_agents`, `opentuna_fins`, etc.) will NOT be renamed since that requires migrations and could break existing data. Only the **frontend display text** and **code identifiers** change.

## Files to Modify (Grouped)

### Group 1: Frontend Components (13 files - rename files + content)
Rename component files from `OpenTuna*` to `ClawSDK*`:
- `src/components/opentuna/OpenTunaContext.tsx` -> content rename all types/exports
- `src/components/opentuna/OpenTunaHub.tsx` -> rename exports
- `src/components/opentuna/OpenTunaHatch.tsx`
- `src/components/opentuna/OpenTunaDNA.tsx`
- `src/components/opentuna/OpenTunaSonar.tsx`
- `src/components/opentuna/OpenTunaMemory.tsx`
- `src/components/opentuna/OpenTunaFins.tsx`
- `src/components/opentuna/OpenTunaIntegrations.tsx`
- `src/components/opentuna/OpenTunaCurrent.tsx`
- `src/components/opentuna/OpenTunaDocs.tsx`
- `src/components/opentuna/OpenTunaApiKeyModal.tsx`
- `src/components/opentuna/OpenTunaAgentSelector.tsx`
- `src/components/opentuna/__tests__/` (any test files)

### Group 2: Hooks (1 file)
- `src/hooks/useOpenTuna.ts` -- rename all interface names (`OpenTunaAgent` -> `ClawAgent`, `OpenTunaDNA` -> `ClawDNA`, etc.), function names (`useOpenTunaAgents` -> `useClawAgents`), and query keys (`opentuna-agents` -> `clawsdk-agents`)

### Group 3: Pages (2 files)
- `src/pages/OpenTunaPage.tsx` -- rename imports, component names, display text
- `src/pages/WhitepaperPage.tsx` -- rename all "OpenTuna" display text to "Claw SDK", update code examples (`@opentuna/sdk` -> `@openclaw/sdk`, `ota_live_` -> `oca_live_`, `new OpenTuna()` -> `new ClawSDK()`)

### Group 4: App Router (1 file)
- `src/App.tsx` -- rename lazy import `OpenTunaPage` -> `ClawSDKPage`, keep `/sdk` route path, keep `/opentuna` redirect

### Group 5: CSS (1 file)
- `src/index.css` -- rename `.opentuna-card`, `.opentuna-gradient-text`, `.opentuna-glow`, `.opentuna-button` to `.clawsdk-card`, `.clawsdk-gradient-text`, `.clawsdk-glow`, `.clawsdk-button`

### Group 6: Edge Functions (16 files - content only, folder names stay)
These edge functions reference `opentuna_*` DB tables (kept) but display text / comments change:
- `supabase/functions/opentuna-agent-hatch/index.ts`
- `supabase/functions/opentuna-api-key-create/index.ts` -- change `ota_live_` prefix to `oca_live_`
- `supabase/functions/opentuna-api-key-validate/index.ts` -- change `ota_live_` validation to `oca_live_`
- `supabase/functions/opentuna-api-key-revoke/index.ts`
- `supabase/functions/opentuna-current-verify/index.ts`
- `supabase/functions/opentuna-dna-update/index.ts`
- `supabase/functions/opentuna-echo-locate/index.ts`
- `supabase/functions/opentuna-fin-bash/index.ts`
- `supabase/functions/opentuna-fin-browse/index.ts`
- `supabase/functions/opentuna-fin-edit/index.ts`
- `supabase/functions/opentuna-fin-forge/index.ts`
- `supabase/functions/opentuna-fin-read/index.ts`
- `supabase/functions/opentuna-fin-trade/index.ts`
- `supabase/functions/opentuna-fin-write/index.ts`
- `supabase/functions/opentuna-memory-store/index.ts`
- `supabase/functions/opentuna-school-delegate/index.ts`
- `supabase/functions/opentuna-school-pay/index.ts`
- `supabase/functions/opentuna-school-sync/index.ts`
- `supabase/functions/opentuna-sonar-ping/index.ts`

Note: Edge function **folder names** cannot be renamed without also renaming the function endpoints, which would break existing API calls. Comments and display strings inside them will be updated.

### Group 7: SDK Package (4+ files)
- `sdk/package.json` -- `@opentuna/sdk` -> `@openclaw/sdk`, update description
- `sdk/src/opentuna.ts` -- rename class `OpenTuna` -> `ClawSDK`, update all references
- `sdk/src/index.ts` -- update exports
- `sdk/README.md` -- update all text

### Group 8: CLI Package (8+ files)
- `cli/package.json` -- `@opentuna/cli` -> `@openclaw/cli`, update all refs
- `cli/src/index.ts` -- update comments
- `cli/src/config.ts` -- rename `OpenTunaConfig` -> `ClawSDKConfig`, update config dir from `.opentuna` to `.openclaw`
- `cli/src/commands/*.ts` (6 files) -- update all display text from "OpenTuna" to "Claw SDK", command references from `opentuna` to `openclaw`

### Group 9: Whitepaper MD
- `public/TUNA_WHITEPAPER.md` -- rename all OpenTuna references to Claw SDK

## Execution Order
1. Hooks file first (most imported)
2. Context/Provider
3. All component files in parallel
4. Page files + App.tsx
5. CSS
6. Edge functions (comments + API key prefix)
7. SDK + CLI packages
8. Whitepaper/docs

## What Does NOT Change
- Database table names (`opentuna_agents`, `opentuna_fins`, etc.) -- these are referenced in queries but renaming requires migrations
- Edge function folder names -- these are deployed endpoints
- Route paths (`/sdk` stays, `/opentuna` redirect stays)
- Any functional logic -- purely cosmetic/naming changes

