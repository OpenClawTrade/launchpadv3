
# Replace Claw Logo with New Transparent PNG

## Overview
Save the uploaded transparent pixel-art lobster PNG as the new `claw-logo.png`, replacing the existing file. This single replacement will automatically update every place in the app that references it (sidebar logo, sidebar NFA/Panel icons, header Panel button, Privy branding, and all other components).

## Steps

1. **Copy uploaded image to `src/assets/claw-logo.png`** (overwrite existing)
   - The uploaded file is a proper transparent PNG
   - Every component already imports from `@/assets/claw-logo.png`, so no code changes needed for those

2. **Copy uploaded image to `public/claw-logo.png`** (overwrite existing)
   - Several components reference `/claw-logo.png` directly (Footer, KingOfTheHill, MemeLoadingAnimation, FunLauncherPage, TokenDetailPage, LaunchpadPage, AgentPlatformToken, useSubTuna)
   - This ensures those direct URL references also get the new image

3. **No code changes required**
   - All imports and references already point to `claw-logo.png`
   - The transparency issue is likely because the current file itself isn't truly transparent -- replacing the file fixes it

## Technical Details

**Files to overwrite (2):**
- `src/assets/claw-logo.png` -- used by ES module imports (Sidebar, AppHeader, PanelPage, PrivyProviderWrapper, etc.)
- `public/claw-logo.png` -- used by direct URL references in ~8 components
