

# Fix: Purge All `lovable.app` and Legacy `tuna` URLs from Codebase

## Problem

Multiple files expose `clawmode.lovable.app` (the Lovable staging subdomain) instead of the production domain `clawmode.fun`. This is visible to users in the SDK docs, API docs, sitemap, and HTML meta tags. Additionally, legacy `@tuna/agent-sdk` and `tuna.fun` references persist in SDK docs and examples.

## Affected Files and Changes

### 1. `index.html` -- Replace all `clawmode.lovable.app` with `clawmode.fun`
- Line 12: canonical URL
- Line 23: og:url
- Line 56: JSON-LD url
- Line 68: JSON-LD organization url

### 2. `public/sitemap.xml` -- Replace all `clawmode.lovable.app` with `clawmode.fun`
- Lines 4, 9, 14: all `<loc>` entries

### 3. `src/components/claw/ClawSDKHub.tsx` -- Fix API curl examples
- Lines 107, 111, 117: Replace `clawmode.lovable.app` with `clawmode.fun`

### 4. `src/pages/ApiDocsPage.tsx` -- Fix BASE_URL and APP_URL constants
- Line 12: `https://api.clawmode.lovable.app` -> `https://api.clawmode.fun`
- Line 13: `https://clawmode.lovable.app` -> `https://clawmode.fun`

### 5. `sdk/README.md` -- Fix legacy branding
- Line 1: "TUNA Agent SDK" -> "Claw Mode Agent SDK"
- Lines 23, 29, 74: `@tuna/agent-sdk` -> `@openclaw/sdk`
- Line 251: `!tunalaunch` -> `!clawmode`

### 6. `sdk/docs/API.md` -- Fix legacy branding
- Line 1: title
- Line 14: `@tuna/agent-sdk` -> `@openclaw/sdk`
- Lines 22, 34, 79: import references

### 7. `sdk/package.json` -- Fix author email
- Line 93: `team@tuna.fun` -> `team@clawmode.fun`

### 8. `sdk/examples/*.ts` (6 files) -- Fix imports
- All `@tuna/agent-sdk` -> `@openclaw/sdk`

### 9. `public/sdk/` (legacy SDK copy) -- Same fixes
- `package.json`: name `@tuna/agent-sdk` -> `@openclaw/sdk`
- `README.md`: `!tunalaunch` -> `!clawmode`, remove Telegram bot reference
- `examples/*.ts`: fix imports

## Summary

Total: ~15 files, all string replacements. Every `clawmode.lovable.app` becomes `clawmode.fun`, every `@tuna/agent-sdk` becomes `@openclaw/sdk`, every `!tunalaunch` becomes `!clawmode`.

