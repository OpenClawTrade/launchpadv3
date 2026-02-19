
# Fix: SDK Page — Remove "OpenTuna" / Tuna Branding, Use "Claw" / ClawMode

## The Problem

The **SDK page** at `/opentuna` has multiple leftover references to the old "OpenTuna" / "tuna.fun" brand:

1. **Route path** — `/opentuna` → should be `/sdk` (or at least de-tuna'd)
2. **Page title in `OpenTunaPage.tsx`** — the tab headers say things like Hub, Hatch, DNA, etc. which are fine, but the page itself is still named `OpenTunaPage` and the file/route is `/opentuna`
3. **SDK code snippets in `OpenTunaHub.tsx`** — references to old `@opentuna/sdk`, `ota_live_...` API key prefix, `npm install @opentuna/sdk`, `SubTuna` in agent descriptions
4. **`OpenTunaDocs.tsx`** — some code blocks still reference `@opentuna/sdk` and `OpenTuna` class (though most already updated to `@openclaw/sdk`)
5. **Sidebar** — "SDK" link correctly points to `/opentuna` — the path just needs renaming

## The Fixes

### 1. `src/App.tsx` — Change route from `/opentuna` to `/sdk`
```
<Route path="/opentuna" element={<OpenTunaPage />} />
→
<Route path="/sdk" element={<OpenTunaPage />} />
```
Also keep a redirect from `/opentuna` → `/sdk` for backward compatibility (the `DomainRouter` currently redirects `os.clawmode.fun` → `/opentuna`, so update that too).

### 2. `src/components/layout/Sidebar.tsx` — Update nav link target
```
{ to: "/opentuna", label: "SDK", icon: Code2 }
→
{ to: "/sdk", label: "SDK", icon: Code2 }
```

### 3. `src/components/DomainRouter.tsx` — Update subdomain redirect
```
navigate("/opentuna", { replace: true })
→
navigate("/sdk", { replace: true })
```

### 4. `src/components/opentuna/OpenTunaHub.tsx` — Fix visible tuna text:
- `"npm install @opentuna/sdk"` → `"npm install @openclaw/sdk"`
- `"Community manager for SubTuna and X..."` → `"Community manager for Claw Mode and X..."`
- `"Generate API keys to access OpenTuna programmatically..."` → `"Generate API keys to access Claw SDK programmatically..."`
- `ota_live_...` API key prefixes in code snippets → `oca_live_...`
- `curl ... @opentuna/sdk` install hint → `@openclaw/sdk`

### 5. `src/components/opentuna/OpenTunaDocs.tsx` — Fix remaining tuna SDK references in code blocks:
- `import { OpenTuna } from '@opentuna/sdk'` → `import { OpenClaw } from '@openclaw/sdk'`
- `new OpenTuna({ apiKey: 'ota_live_...' })` → `new OpenClaw({ apiKey: 'oca_live_...' })`
- `npm install @opentuna/sdk` → `npm install @openclaw/sdk`

## Files Changed

| File | Change |
|---|---|
| `src/App.tsx` | Route `/opentuna` → `/sdk`, add redirect for old path |
| `src/components/layout/Sidebar.tsx` | Nav link `to="/opentuna"` → `to="/sdk"` |
| `src/components/DomainRouter.tsx` | Redirect target `/opentuna` → `/sdk` |
| `src/components/opentuna/OpenTunaHub.tsx` | Fix 4–5 visible tuna text strings |
| `src/components/opentuna/OpenTunaDocs.tsx` | Fix remaining `@opentuna/sdk` / `OpenTuna` class / `ota_live_` in code blocks |

## What Does NOT Change

- All component file names stay as-is (`OpenTunaHub`, `OpenTunaHatch`, etc.) — these are internal code names, not visible to users
- The tab labels (Hub, Hatch, DNA, Sonar, Fins, etc.) stay the same — they're already brand-neutral
- Database table names (`opentuna_agents`, etc.) are untouched — backend is separate from branding
- CSS class names like `opentuna-card`, `opentuna-button` stay as-is — internal style tokens
