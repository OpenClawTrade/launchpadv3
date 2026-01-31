

# Fix Loading Animation Text Position

## Problem
The loading text ("Generating...", "Cooking up alpha...", "Your next moonshot meme coin incoming!") is currently displayed **outside** the image preview area, in a separate container. The user wants the text to appear **inside** the animation, overlaid on the image itself.

## Current Structure
```
┌─────────────────────────────────────────────────────┐
│  [Avatar Box]          │  [Info Box - SEPARATE]     │
│  MemeLoadingAnimation  │  MemeLoadingText           │
│  (image only)          │  (text only)               │
└─────────────────────────────────────────────────────┘
```

## Desired Structure
```
┌─────────────────────────────────────────────────────┐
│  [Avatar Box - CONTAINS BOTH]                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  TUNA logo + sparkles                       │    │
│  │  ••• Generating...                          │    │
│  │  🔥 Cooking up alpha...                     │    │
│  │  Your next moonshot meme coin incoming!     │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Solution
Merge the `MemeLoadingText` content directly into the `MemeLoadingAnimation` component so everything appears within the same container.

---

## Technical Changes

### File: `src/components/launchpad/MemeLoadingAnimation.tsx`

**Update `MemeLoadingAnimation` component to include the loading text:**
- Add the animated dots and "Generating..." text
- Add the rotating fun message
- Add the "Your next moonshot meme coin incoming!" tagline
- Position text below the TUNA logo within the same container

**Keep `MemeLoadingText` as a legacy export** (for backwards compatibility) but have it render nothing or minimal content, since the animation now handles everything.

### Modifications:

1. **Inside `MemeLoadingAnimation`**: Add text elements below the logo but still within the animation container:
   - Bouncing dots + "Generating..." label
   - Fun rotating message
   - Tagline text

2. **Adjust layout**: The component uses flexbox with `flex-col` to stack logo and text vertically, all centered within the animation area.

3. **Update `MemeLoadingText`**: Return an empty fragment or remove it where used, since all content is now in the animation.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/launchpad/MemeLoadingAnimation.tsx` | Merge text into animation component |
| `src/components/launchpad/TokenLauncher.tsx` | Remove separate `MemeLoadingText` usage (optional cleanup) |

