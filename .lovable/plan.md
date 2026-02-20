

## Fix Mobile Responsiveness for Whitepaper and Footer

### Problem
From the screenshot, two main issues are visible on mobile:
1. The **sticky stats bar** at the bottom (TOKENS | AGENTS | FEES CLAIMED) is cut off on the right side
2. The **whitepaper page** content overflows horizontally -- the title gets clipped

### Root Causes

**Stats Footer (`StickyStatsFooter.tsx`)**
- Has a hardcoded `paddingLeft: "160px"` to offset for the desktop sidebar, but on mobile there is no sidebar -- this wastes 160px and pushes stats off-screen
- Fix: Use `paddingLeft: 0` on mobile (below 768px breakpoint)

**Whitepaper Page (`WhitepaperPage.tsx`)**
- The outer wrapper has no `overflow-x-hidden`, so wide content (long headings, code blocks, grids) can cause horizontal scroll on mobile
- Code/pre blocks inside sections have no `overflow-x-auto` or `max-width` constraints
- The title text at the top gets clipped

**Footer (`Footer.tsx`)**
- Generally OK but needs `overflow-hidden` on the parent to prevent any edge-case overflow

### Changes

**1. `src/components/layout/StickyStatsFooter.tsx`**
- Make `paddingLeft` responsive: `0` on mobile, `160px` on desktop
- Use a CSS media query or the `useIsMobile` hook to toggle
- On mobile, reduce stat items to show fewer or wrap them with horizontal scroll

**2. `src/pages/WhitepaperPage.tsx`**
- Add `overflow-x-hidden` to the outer container div
- Ensure all `pre`/code blocks have `overflow-x-auto` and `max-w-full`
- Add `break-words` / `overflow-wrap` to long text sections

**3. `src/components/layout/Footer.tsx`**
- Add `overflow-hidden` to the footer wrapper to prevent any horizontal bleed

**4. `src/components/layout/LaunchpadLayout.tsx`**
- Add `overflow-x-hidden` to the outer wrapper to prevent global horizontal scroll on mobile across all pages

### Technical Details

```text
StickyStatsFooter.tsx:
  Line 39: paddingLeft: "160px"
  Change to: paddingLeft: isMobile ? "0px" : "160px"
  (import useIsMobile hook)

WhitepaperPage.tsx:
  Line 38: <div className="min-h-screen bg-background">
  Change to: <div className="min-h-screen bg-background overflow-x-hidden">

LaunchpadLayout.tsx:
  Line 17: <div className="min-h-screen bg-background">
  Change to: <div className="min-h-screen bg-background overflow-x-hidden">
```

This will fix the horizontal overflow across all pages on mobile and ensure the stats footer is fully visible and centered.
