

# Site-Wide OpenClaw Color Scheme + Size Reduction

## Overview

Two major changes across the entire site:
1. Replace the green Gate.io color scheme with the OpenClaw red/teal dark theme as the default
2. Scale the entire UI down to ~75% so it looks correct at 100% browser zoom

---

## Part 1: Color Scheme -- OpenClaw Dark Theme

The OpenClaw palette uses deep dark backgrounds with red/coral primary accents and teal secondary accents. The current claw-theme already has these colors but they are only applied to `/claw` routes. This change makes them the site-wide default.

### Files to update:

**`src/index.css`** -- Update CSS custom properties for both `:root` and `.dark`:
- `--primary`: change from green `152 69% 41%` to red `0 84% 60%`
- `--background` (dark): change to deeper black `240 20% 4%`
- `--background-secondary` (dark): `240 15% 7%`
- `--card` (dark): `240 15% 7%`
- `--border` (dark): `240 15% 14%`
- `--accent`: teal `187 80% 53%`
- `--ring`: red `0 84% 60%`
- `--success` stays green for price-up indicators
- All shadow-glow references change from green to red

**`src/styles/gate-theme.css`** -- Update the gate-theme variables:
- `--gate-primary`: `0 84% 60%` (red) instead of green
- `--gate-primary-hover`: `0 84% 50%`
- `--gate-primary-light`: `0 84% 15%` (dark red tint for dark mode)
- Dark mode backgrounds: deeper blacks matching OpenClaw (`240 20% 4%`, `240 15% 7%`, `240 15% 10%`)
- Dark mode borders: `240 15% 14%`
- Progress bar gradient: red instead of green
- All `.gate-price-up` stays green, `.gate-price-down` stays red (trading convention)

**`tailwind.config.ts`** -- Update the `gate` color references:
- Change gate DEFAULT from green to red hsl values
- Update `--shadow-glow` to use red tint

---

## Part 2: Size Reduction (~75% Scale)

The user confirmed the site looks correct at 75% browser zoom. Rather than editing hundreds of individual Tailwind classes, we set the root font-size to 12px (75% of the 16px default). Since Tailwind uses `rem` units, this automatically scales all spacing, text sizes, widths, and heights proportionally.

### Files to update:

**`src/index.css`** -- Add to `html`:
```css
html {
  font-size: 12px;
}
```

**`src/styles/gate-theme.css`** -- Adjust px-based values that won't scale with rem:
- Header height: `56px` to `42px`
- Fixed paddings in px: scale down by 25%
- Token avatar: `36px` to `28px`
- Logo icon: `32px` to `24px`
- Input height: `44px` to `34px`
- Scrollbar width: `8px` to `6px`

**`src/styles/claw-theme.css`** -- Already uses rem, minimal changes needed for any px values

**`src/components/layout/LaunchpadLayout.tsx`** -- Adjust max-width from `1400px` to `1050px` (75%)

**`src/components/layout/AppHeader.tsx`** -- Logo image size adjustments (h-8 w-8 classes will auto-scale with rem)

**`src/components/layout/Footer.tsx`** -- Spacing adjustments auto-scale

---

## Part 3: Nebula/Stars Background Effect

OpenClaw has a subtle stars and nebula background. The claw-theme already has `.claw-nebula`. We extend this to be applied site-wide in the gate-theme.

**`src/styles/gate-theme.css`** -- Add nebula gradient overlay to `.gate-theme.dark`:
```css
.gate-theme.dark {
  background:
    radial-gradient(ellipse at 20% 50%, hsl(0 84% 60% / 0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, hsl(187 80% 53% / 0.04) 0%, transparent 50%),
    hsl(240 20% 4%);
}
```

---

## Summary of Files Changed

| File | Changes |
|------|---------|
| `src/index.css` | Root font-size 12px, dark theme vars to red/teal/deep-black |
| `src/styles/gate-theme.css` | Primary colors green-to-red, dark BG deeper, px values scaled 75%, nebula BG |
| `src/styles/claw-theme.css` | Minor alignment if any px values remain |
| `tailwind.config.ts` | Gate color palette update |
| `src/components/layout/LaunchpadLayout.tsx` | Max-width adjustment |

No database changes. No new dependencies. No new files. Pure CSS/styling update.

