

# Rename All "TUNA OS" to "OpenTuna" Across the Entire App

## Problem
Only the `AppHeader.tsx` span was updated last time. The brand name "TUNA OS" still appears in **7+ other files**, including the FunLauncherPage (which has its own header -- this is what you're seeing in the screenshot).

## Changes

### 1. `src/pages/FunLauncherPage.tsx` (lines 167-174)
- `aria-label="TUNA OS"` -> `"OpenTuna"`
- `alt="TUNA OS"` -> `"OpenTuna"`
- `<span>TUNA OS</span>` -> `<span>OpenTuna</span>`

### 2. `src/components/layout/AppHeader.tsx` (line 58)
- `alt="TUNA OS"` -> `"OpenTuna"` (the span was fixed but the img alt was missed)

### 3. `src/components/layout/Footer.tsx`
- Line 12: `alt="TUNA OS"` -> `"OpenTuna"`
- Line 13: `<span>TUNA OS</span>` -> `<span>OpenTuna</span>`
- Line 86: `© 2025 TUNA OS` -> `© 2025 OpenTuna`

### 4. `src/pages/CareersPage.tsx`
- Line 210: `"Back to TUNA OS"` -> `"Back to OpenTuna"`
- Line 232: `"building TUNA OS"` -> `"building OpenTuna"`
- Line 337: `"future of TUNA OS"` -> `"future of OpenTuna"`
- Line 343: `"TUNA OS platform"` -> `"OpenTuna platform"`

### 5. `src/components/migration/MigrationPopup.tsx` (line 45)
- `"powering TUNA OS"` -> `"powering OpenTuna"`

### 6. `index.html`
- Line 10: `content="TUNA OS"` -> `"OpenTuna"`
- Line 19: `content="TUNA OS"` -> `"OpenTuna"`
- Line 20: `"TUNA OS v3.1.0 - AI Agent Operating System"` -> `"OpenTuna - AI Agent Operating System"`

**Note**: The WhitepaperPage reference "OpenTuna OS" (line 109) already uses "OpenTuna" so it will be left as-is.

