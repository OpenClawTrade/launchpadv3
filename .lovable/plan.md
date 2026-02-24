

# Premium Luxury Dark Theme Upgrade

Upgrade the Pulse terminal cards and surrounding elements from flat grey to a deep, rich, luxurious dark theme with proper depth and elevation.

## What Changes

### 1. Dark Theme CSS Variables (src/index.css)
Update the `.dark` theme variables for deeper blacks and better contrast:
- `--card`: change from `0 0% 10%` to `0 0% 6%` (deep rich black #0f0f0f)
- `--border`: change from `0 0% 18%` to `0 0% 16%` (#2a2a2a)
- `--border-light`: change from `0 0% 22%` to `0 0% 20%`
- `--surface-hover`: change from `0 0% 14%` to `0 0% 9%`
- `--muted-foreground`: change from `0 0% 50%` to `0 0% 55%` (brighter secondary text)

### 2. Card Styling (src/index.css - `.pulse-card` block)
- Background: `hsl(0 0% 6%)` (deep black, from the updated --card var)
- Border: `1px solid #2a2a2a`
- Add subtle inner shadow for depth: `inset 0 1px 0 0 hsl(0 0% 100% / 0.03)`
- Base shadow: `0 2px 8px -2px rgb(0 0 0 / 0.5)`
- Hover: border `hsl(var(--success) / 0.6)`, stronger glow `0 0 0 3px rgba(34,197,94,0.12)`, `shadow-md`, `translateY(-2px) scale(1.008)`

### 3. Avatar (src/index.css - `.pulse-avatar`)
- Size stays 52x52px
- Add a thin border: `1px solid hsl(0 0% 20%)`
- Add subtle dark overlay via box-shadow: `inset 0 0 0 1px rgb(0 0 0 / 0.2)`

### 4. SOL Button Gradient (src/index.css - `.pulse-sol-btn`)
- Change from flat `hsl(217 91% 53%)` to gradient: `linear-gradient(135deg, #2563eb, #3b82f6)`
- Larger padding: `6px 16px`
- Hover: `linear-gradient(135deg, #3b82f6, #60a5fa)` + glow shadow

### 5. Text Contrast Improvements (AxiomTokenRow.tsx + CodexPairRow.tsx)
- Ticker name: keep `text-foreground` (white), already good
- Secondary text ("by Pump.fun", age, address): change from `text-muted-foreground/50` and `/60` to `text-[#bbbbbb]` for consistent readable contrast
- Metric values (V, F, TX): change from `text-foreground/75` and `/65` to `text-foreground/85` and `text-foreground/80` for higher contrast
- Holder counts: from `text-muted-foreground/60` to `text-[#aaa]`

### 6. Column Headers (src/index.css - `.pulse-col-header`)
- Background: slightly elevated `hsl(0 0% 7%)` 
- Title text: brighter white
- Icons: higher contrast

### 7. Card Divider in Bottom Bar (AxiomTokenRow.tsx + CodexPairRow.tsx)
- Change `border-border/40` to `border-[#2a2a2a]` for consistent visible separator

### 8. Metric Labels (src/index.css - `.pulse-metric-label`)
- Change opacity from `0.6` to `0.5` -- keep them subtle but the values themselves get higher contrast

### 9. Metric Dots / Badges
- `.pulse-metric-dot--neutral`: background stays muted, but text contrast bumped to `0.7`
- `.pulse-metric-dot--success`: slightly stronger green background `0.2` opacity

## Files Modified
1. **src/index.css** -- dark theme variables, `.pulse-card`, `.pulse-avatar`, `.pulse-sol-btn`, `.pulse-col-header`, `.pulse-metric-label`, `.pulse-metric-dot` classes
2. **src/components/launchpad/AxiomTokenRow.tsx** -- text contrast classes on secondary text and metric values
3. **src/components/launchpad/CodexPairRow.tsx** -- same text contrast improvements

## What Stays Untouched
- Left sidebar (CLAW MODE) -- 100% untouched
- Top header bar -- 100% untouched
- Sticky stats footer -- 100% untouched
- All data hooks and features -- 100% untouched
- 3-column layout structure -- 100% untouched
- AxiomTerminalGrid.tsx -- no changes needed (inherits from CSS)

