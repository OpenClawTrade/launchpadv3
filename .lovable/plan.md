

# Visual Polish Upgrade -- Premium Web3 Dashboard Aesthetic

## Overview
Apply a deep visual and interaction upgrade across the entire Claw Mode dashboard to match the quality of top-tier Solana apps (Jupiter, Birdeye, Drift). **No DOM structure, content, or layout changes** -- purely visual refinements to colors, typography, spacing, borders, shadows, transitions, and micro-interactions.

## Files to Modify

### 1. `src/index.css` -- Core Design System Overhaul
- Update CSS custom properties for the dark theme:
  - Background: `#0B0E17` base with subtle gradient support
  - Surface/card: `#111827` / `#1A2236` with glass blur support
  - Border: `rgba(255,255,255,0.06)` / `#1F2937`
  - Text hierarchy: primary `#E2E8F0`, secondary `#94A3B8`, muted `#64748B`
  - Success `#10B981`, error `#EF4444`, accent purple `#8B5CF6`
- Add new CSS utility classes:
  - `.glass-surface` -- backdrop-filter blur(12px) + semi-transparent bg
  - `.btn-gradient-green` -- gradient `#10B981` to `#059669` with hover scale + glow
  - `.hover-lift` -- scale(1.02) + shadow-lg + brightness(1.05) on hover, 200ms spring easing
  - `.press-down` -- scale(0.98) on active, 80ms
  - `.focus-ring-purple` -- 2px solid `#8B5CF6/40` outline
  - `.shimmer-skeleton` -- improved skeleton shimmer animation
  - `.pulse-dot` -- pulsing online indicator animation
  - `.empty-state-fade` -- gentle fade-in for empty states
- Import 'Inter Tight' or keep 'Inter' as primary; 'JetBrains Mono' as monospace for stats
- Update font sizing: html base stays 12px, refine heading/body scale
- Add letter-spacing `-0.01em` utility for headings

### 2. `tailwind.config.ts` -- Extended Theme Tokens
- Add new color tokens: `surface`, `surface-hover`, `glass`, `accent-purple`, `accent-cyan`
- Update border-radius defaults: cards/panels 12-16px, pills 9999px
- Add shadow presets: `soft`, `glow-green`, `glow-purple`
- Add transition timing: `spring` cubic-bezier(0.34, 1.56, 0.64, 1)
- Add spacing values for 8px grid alignment (if not present)

### 3. `src/components/layout/Sidebar.tsx` -- Sidebar Polish
- Background: gradient from `#0F1219` to `#0B0E17`
- Nav items: padding 14px 20px, rounded-xl, hover bg `rgba(255,255,255,0.04)`
- Active indicator: gradient green left border, subtle green bg tint
- Logo area: refined spacing, slightly larger gap
- "Create Token" button: gradient green background with hover glow effect
- Matrix toggle: refined styling with glass surface
- All transitions: 200ms ease-out
- "clawmode.io" text: slightly brighter muted color

### 4. `src/components/layout/AppHeader.tsx` -- Header Polish
- Background: `#0B0E17` with bottom border `rgba(255,255,255,0.06)`
- Search input: glass-style bg, rounded-xl, focus ring purple accent
- "Panel" button: refined border glow, hover scale(1.02)
- "Create Token" button: gradient green with hover glow + scale effect
- X logo button: hover rotate(8deg) + color shift
- Price displays: monospace weight 500
- All interactive elements: 180-200ms transitions

### 5. `src/components/layout/Footer.tsx` -- Footer Polish
- Background: subtle glass with `backdrop-blur-md`
- Border: `rgba(255,255,255,0.06)`
- Section titles: weight 600, letter-spacing -0.01em
- Links: hover color shift to green accent with underline animation
- "Hiring" badge: refined with green gradient bg
- Bottom bar: refined spacing, muted text improvements

### 6. `src/components/layout/StickyStatsFooter.tsx` -- Stats Bar Polish
- Background: `#0B0E17` with top border `rgba(255,255,255,0.06)`
- Stat labels: `#64748B`, uppercase tracking-wide
- Stat values: `#E2E8F0`, JetBrains Mono / IBM Plex Mono weight 500
- Connection dot: pulsing animation with `@keyframes pulse`
- Dividers: subtle `rgba(255,255,255,0.08)`
- Overall: refined padding and alignment

### 7. `src/pages/FunLauncherPage.tsx` -- Homepage Polish
- Main background: gradient from `#0A0E1A` to `#05070F`
- "Just Launched" cards: glass surface, rounded-xl (12px), refined hover with scale(1.02) + shadow-lg + green border glow
- "King of the Claws" cards: same glass treatment, refined progress bars
- Filter tabs: refined active state with gradient green underline, hover bg transition
- Token grid skeleton: improved shimmer animation
- Empty state: glass card with larger muted text, subtle fade-in animation
- Online indicator: refined pulsing dot with green glow
- All card borders: `rgba(255,255,255,0.06)` default, green accent on hover
- Spacing between sections: 32-40px

### 8. `src/components/launchpad/TokenCard.tsx` -- Token Card Polish
- Card background: `#111827` / glass surface
- Border: `rgba(255,255,255,0.06)`, hover: green accent with glow
- Hover: scale(1.02) + shadow-lg, 200ms spring easing
- Badge pills: refined with softer bg opacity + rounded-full
- Ticker text: `#10B981` (refined green)
- Progress bar: rounded-full, green gradient fill
- Text: refined sizes and weights for hierarchy

### 9. `src/components/launchpad/StatsCards.tsx` -- Stats Cards Polish
- Surface: glass with backdrop-blur
- Border: subtle `rgba(255,255,255,0.06)`
- Icon colors: refined with accent tones
- Values: monospace weight 500, `#E2E8F0`
- Labels: `#64748B`, tracking-wide

### 10. `src/pages/LaunchTokenPage.tsx` -- Create Token Page Polish
- Background: gradient
- Cards: glass surfaces, rounded-xl, refined borders
- Accent color: keep red `#e84040` but refine with subtle glow shadows
- Platform info rows: refined spacing, divider colors
- "Pro Tip" card: subtle red glow border
- Steps: refined numbering with accent color

### 11. `src/components/launchpad/MemeLoadingAnimation.tsx` -- Loading Animation Polish
- Refine sparkle/floating particle animations
- Smoother bounce timing
- Glass backdrop if applicable

## Technical Approach
- All changes are CSS/Tailwind class updates and inline style refinements
- No DOM structure changes, no element additions/removals
- Keep every text label, emoji, number, and placeholder exactly as-is
- Add CSS keyframes in `index.css` for new micro-interactions
- Use arbitrary Tailwind values where custom tokens don't exist
- Ensure all transitions use consistent timing (180-250ms)
- Focus rings: purple accent for accessibility
- All hover states: smooth spring-eased transitions

## Execution Order
1. Update `tailwind.config.ts` with new tokens
2. Update `src/index.css` with new theme variables + utility classes
3. Update layout components (Sidebar, AppHeader, Footer, StickyStatsFooter)
4. Update page components (FunLauncherPage, LaunchTokenPage)
5. Update shared components (TokenCard, StatsCards, MemeLoadingAnimation)
6. Screenshot verification after each major file group

