
# Fix Matrix Mode Background

## Root Cause

The `MatrixBackground` canvas renders at `z-index: -1` (behind everything), but the page body (`bg-background`) and the main page container (`FunLauncherPage` with `bg-background`) both use a **fully opaque** dark navy background color (`hsl(225 40% 5%)`). This completely covers the canvas, making the matrix rain invisible.

## Solution

Make the body and main page backgrounds **transparent** so the canvas shows through, while keeping the visual appearance identical by having the canvas's own fade color (`rgba(10, 10, 15, 0.04)`) naturally produce the dark background over time.

### Changes Required

### 1. `src/index.css` (body background)
- Change the `body` rule from `@apply bg-background` to `background: transparent` so the canvas behind it is visible.
- Add the dark background color to the `html` element instead, so the overall page still appears dark before the canvas loads.

### 2. `src/pages/FunLauncherPage.tsx`
- Change the root `<div className="min-h-screen bg-background">` to use a transparent or semi-transparent background (e.g., `bg-transparent` or `bg-background/0`) so the matrix rain shows through.

### 3. `src/components/layout/AppHeader.tsx`
- Change `bg-background` to `bg-background/80 backdrop-blur-md` so the header is slightly translucent, letting the matrix rain peek through while keeping text readable.

### 4. `src/components/layout/Sidebar.tsx`
- Apply similar semi-transparent treatment to the sidebar background so matrix rain is subtly visible behind it too.

### 5. `src/components/claw/MatrixBackground.tsx`
- Change canvas `zIndex` from `-1` to `0` so it sits at the base stacking level, with the rest of the content above it via natural DOM order and `position: relative`.
- This is more reliable than negative z-index which can be clipped by stacking contexts.

## Technical Detail

The key insight: `z-index: -1` on a fixed canvas only works if all ancestor/sibling containers above it have transparent backgrounds. Since the recent visual polish update made `bg-background` opaque everywhere, the matrix became invisible. The fix makes the main content areas transparent/translucent so the fixed canvas shows through.
