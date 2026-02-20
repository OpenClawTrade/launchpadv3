

# Fix Logo Transparency

## Problem
The claw logo PNG renders with a visible background square instead of being transparent. This appears in:
- Sidebar top-left logo (next to "CLAW MODE")
- NFA nav icon
- Panel nav icon
- Header "Panel" button icon

## Root Cause
The current `claw-logo.png` files still have a non-transparent background despite the re-upload. The image file itself contains a solid background behind the lobster pixel art.

## Solution
Re-save the uploaded transparent PNG to both asset locations, ensuring the alpha channel is preserved:

1. **Overwrite `src/assets/claw-logo.png`** with the user-uploaded transparent PNG
2. **Overwrite `public/claw-logo.png`** with the same file

If the PNG still renders with a background after re-copy (indicating the source file itself has a white background), apply a CSS fallback:
- Add `mix-blend-mode: screen` to all logo `<img>` elements on dark backgrounds -- this will make white pixels transparent against dark surfaces

### Files to modify (CSS fallback if needed):
- `src/components/layout/Sidebar.tsx` -- add `mix-blend-mode: screen` style to all logo `<img>` tags
- `src/components/layout/AppHeader.tsx` -- same for header Panel button icon
- `src/components/layout/Footer.tsx` -- same for footer logo

### Approach
1. First, re-copy the uploaded image to both paths
2. Take a screenshot to verify
3. If still not transparent, apply the CSS `mix-blend-mode: screen` fix to all logo images as a guaranteed workaround on dark backgrounds

