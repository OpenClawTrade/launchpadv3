

# Fix Download Button & X Button Visibility in Token Launchpad

## Problem
1. Download button on the image overlay is not visible/findable by users
2. X (clear) button on the image is not visible enough
3. User wants the download button moved **next to the ticker input**, styled green, labeled "Download Generated img"

## Changes

### 1. ImagePreviewOverlay — Remove download button, fix X button visibility
- **Remove** the download button entirely from `ImagePreviewOverlay.tsx` — it will live outside the image
- **Fix X button**: Use a solid red/destructive background with white icon, larger hit area, always visible (no hover dependency). Something like `bg-red-600 text-white` with a clear `X` icon

### 2. TokenLauncher.tsx — Phantom mode (lines ~2451-2460)
- **Add a green "Download Generated img" button** next to the ticker input row (after the `$TICKER` input)
- Only show it when an image exists (`phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl`)
- Style: green background (`bg-green-600 hover:bg-green-700 text-white`), compact, with Download icon
- **Remove** the existing download button overlay from the phantom image area (lines 2385-2401)

### 3. Other modes (Random, Describe, Realistic, Custom, Holders, Fun)
- These use `ImagePreviewOverlay` which will no longer have a download button
- Add a similar green download button next to each mode's ticker input, shown only when image data exists

### Files to modify
- `src/components/launchpad/ImagePreviewOverlay.tsx` — remove download button, fix X visibility
- `src/components/launchpad/TokenLauncher.tsx` — add green download buttons next to ticker inputs across all modes, remove inline download from phantom mode

