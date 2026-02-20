

# Fix Logo Transparency with CSS Mask

## Problem
The claw-logo.png has a white background baked into the image file. The "badge" approach (black background + padding) still shows a visible square. The user wants the logo to appear with no background at all.

## Solution
Use CSS `mask-image` to render only the non-white pixels of the logo as a solid color shape. This eliminates the white background entirely without needing a new image file.

Replace every logo `<img>` tag with a `<div>` that uses the logo as a CSS mask, filled with a solid color (green `#4ade80` or white depending on context).

## Changes

### 1. `src/components/layout/Sidebar.tsx`
- **Main logo (line 64):** Replace `<img>` with a masked `<div>`:
  ```tsx
  <div className="h-7 w-7 rounded" style={{
    WebkitMaskImage: `url(${LOGO_SRC})`,
    maskImage: `url(${LOGO_SRC})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    backgroundColor: '#4ade80'
  }} />
  ```
- **Nav icons (line 83):** Same approach but smaller (`h-4 w-4`) and white color for inactive, green for active

### 2. `src/components/layout/AppHeader.tsx`
- **Panel button icon (line 85):** Replace `<img>` with masked div, green color (`#4ade80`), `h-4 w-4`

### 3. `src/components/layout/Footer.tsx`
- **Footer brand logo (line 12):** Replace `<img>` with masked div, white color, `h-6 w-6`

### 4. `src/components/launchpad/MemeLoadingAnimation.tsx`
- **Loading logo (line 44):** Replace `<img>` with masked div, green color, `w-10 h-10`, keep bounce animation

## Verification
After each file change, take a browser screenshot to confirm the logo renders correctly with no background square visible.

