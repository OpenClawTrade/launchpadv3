

# Replace Logo with Transparent Background Version

## What We're Doing
Replace the current `claw-logo.png` (which has a white background baked in) with your uploaded transparent-background lobster logo. Then remove all the `background: '#000', padding: '1px'` badge workarounds since they'll no longer be needed.

## Steps

### 1. Copy the new logo to both locations
- Copy `user-uploads://result.png` to `src/assets/claw-logo.png` (used by ES6 imports)
- Copy `user-uploads://result.png` to `public/claw-logo.png` (used by direct URL references)

### 2. Remove badge workarounds from all components
Strip `style={{ background: '#000', padding: '1px' }}` from every logo `<img>` tag since the transparent PNG no longer needs it.

**Files to update:**
- `src/components/layout/Sidebar.tsx` -- main logo and nav item icons (2 spots)
- `src/components/layout/AppHeader.tsx` -- Panel button icon
- `src/components/layout/Footer.tsx` -- footer brand logo
- `src/components/launchpad/MemeLoadingAnimation.tsx` -- loading animation logo

### 3. Verify
Take a screenshot to confirm the lobster renders cleanly with no background square anywhere.

## Technical Detail
The image has a **white background** (not transparent). Looking at it more closely, the uploaded PNG appears to have a white/light background. If so, the same issue will persist. We'll test it and if needed, we can use the CSS `mix-blend-mode: multiply` trick on a dark background to make the white disappear, or fall back to the badge style.

**Fallback approach if white bg persists:**
```css
mix-blend-mode: screen; /* makes white pixels transparent on dark backgrounds */
```

This is a quick, non-destructive test -- if it doesn't look right we can revert immediately.

