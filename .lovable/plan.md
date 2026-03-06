

## Redesign: KingCard Token Card (King of the Hill)

Based on the reference screenshot and the listed issues, the KingCard in `KingOfTheHill.tsx` needs a visual overhaul. The `CodexPairRow` (Pulse terminal list card) is a separate component — the screenshot clearly shows the KingCard layout (vertical card with image, mcap, progress bar, quick buy button).

### Problems Identified

1. **X/Twitter handle**: When missing, no placeholder shown → layout shifts between cards
2. **Quick Buy button**: Uses generic `pulse-sol-btn` class (chartreuse pill) — doesn't match the prominent yellow-gold button in the reference screenshot
3. **Progress bar**: Label and percentage too small, bar too thin (6px)
4. **Visual hierarchy**: MCap price doesn't pop enough, change % is small
5. **Mobile cramping**: Card padding and text sizing not optimized
6. **Card hover**: Decent but can be improved with glow

### Changes — `src/components/launchpad/KingOfTheHill.tsx`

**1. X handle fallback (line ~251-259)**
- Always show X icon row. If no `xUser`, display `— None` in muted text
- Prevents layout shift when some cards have handles and others don't

**2. Quick Buy button styling**
- Replace the generic `PulseQuickBuyButton` wrapper div with a styled container
- Add new CSS class `king-quick-buy-btn` in `src/index.css` with:
  - Gold gradient background (`#F4C430 → #FFB300`)
  - White bold text, 13px font
  - `border-radius: 12px`, padding `8px 20px`
  - Hover: `scale(1.03)`, `box-shadow: 0 0 16px rgba(244,196,48,0.4)`
  - Same height as "Trade" button
- Place "Trade" and "Quick Buy" side-by-side with equal flex, gap-2

**3. Progress bar improvements**
- Increase height from 6px to 8px
- "BONDING PROGRESS" label left-aligned, percentage right-aligned, both `text-[10px]` uppercase mono
- Match the reference screenshot layout exactly

**4. MCap visual hierarchy**
- MCap price: bump to `text-xl` bold
- Change % displayed as colored pill/badge next to price (red/green bg)

**5. Card layout & spacing**
- Token image: larger, aspect-ratio preserved, rounded-xl
- Description line: 2-line clamp if description exists
- CA address with copy button inline
- Consistent 20px padding, gap-4 between sections

**6. Mobile responsive**
- On screens < 380px, Trade + QuickBuy stack vertically
- Use `clamp()` for key font sizes

### Changes — `src/index.css`

Add new CSS class:
```css
.king-quick-buy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  background: linear-gradient(135deg, #F4C430, #FFB300);
  color: #fff;
  transition: all 200ms ease;
  flex-shrink: 0;
}
.king-quick-buy-btn:hover {
  transform: scale(1.03);
  box-shadow: 0 0 16px rgba(244,196,48,0.4);
}
.king-quick-buy-btn:active {
  transform: scale(0.97);
}
.king-quick-buy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
```

### Files to Modify
- `src/components/launchpad/KingOfTheHill.tsx` — KingCard component rewrite
- `src/index.css` — Add `king-quick-buy-btn` styles
- `src/components/launchpad/PulseQuickBuyButton.tsx` — No changes (reused as-is, just wrapper styling changes)

### What Will NOT Change
- Overall KingOfTheHill container/layout (3-column row)
- Rank badge system / glow logic
- PulseQuickBuyButton internal logic (swap, popover, auth)
- CodexPairRow component (separate card, not in scope)
- No new features added

