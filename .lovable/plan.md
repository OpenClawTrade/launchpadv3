

# Fix Logo Visibility

## Problem
The `mix-blend-mode: screen` CSS trick was applied to hide the white background of the logo PNG, but it also makes the logo itself invisible (since `screen` blend on a dark background effectively erases dark/colored pixels and keeps only bright ones — and if the logo has light colors on white, everything fades out).

## Solution
Remove `mix-blend-mode: screen` from all logo `<img>` tags and instead give each logo image a small dark background container with rounded corners. This way the white-background PNG looks intentional and clean — like a logo badge — against the dark sidebar/header.

Alternatively, since the sidebar background is `#1a1a1a` (very dark), we can wrap the logo in a container with `background: #000; border-radius: 4px; overflow: hidden` which will make the white PNG background blend naturally as a small badge.

## Changes

### `src/components/layout/Sidebar.tsx`
- **Line 64**: Remove `style={{ mixBlendMode: 'screen' }}` from the main logo `<img>`, add a wrapper div with dark background + rounded corners
- **Line 84**: Same for the NFA/Panel nav icon logos

### `src/components/layout/AppHeader.tsx`
- Remove `style={{ mixBlendMode: 'screen' }}` from the Panel button logo

### `src/components/layout/Footer.tsx`
- Remove `style={{ mixBlendMode: 'screen' }}` from the footer logo

### `src/components/launchpad/MemeLoadingAnimation.tsx`
- Remove `style={{ mixBlendMode: 'screen' }}` from the loading animation logo

### Approach
Replace `mixBlendMode: 'screen'` with a simple dark rounded background wrapper on each logo image, making it appear as a clean badge icon. This preserves the logo's actual colors and pixel art while looking intentional on dark surfaces.

### Technical Details
Each logo `<img>` will be wrapped or styled with:
```tsx
<img 
  src={LOGO_SRC} 
  className="h-7 w-7 object-contain rounded" 
  style={{ background: '#000', padding: '1px' }} 
/>
```
This gives the logo a tiny black border/background that contains the white PNG background and makes it look like a proper badge icon.
