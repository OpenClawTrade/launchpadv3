
# Fix: Restore Sticky Stats Footer

## What Happened

There are two separate stats bars in the codebase — you asked to remove one, and the wrong one was removed:

1. **`StickyStatsFooter`** — the proper fixed-position bar at the very bottom of the screen (fixed, always visible, uses `position: fixed` via a React portal). This is what you WANTED to keep.

2. **Inline stats strip in `FunLauncherPage.tsx`** (lines 386–403) — a static `<div>` bar embedded inside the page's `<main>` content. This is the one visible in your screenshot (highlighted in green). This is what you WANTED removed.

What was done previously:
- The `StickyStatsFooter` import was left in `App.tsx` but it was **never added to the JSX** — so the sticky footer was never rendering.
- The inline strip in `FunLauncherPage.tsx` was left untouched — it's still there floating in the page.

## The Fix

Two changes:

### 1. `src/App.tsx` — Render `<StickyStatsFooter />` inside the JSX
Add `<StickyStatsFooter />` back inside the `<ErrorBoundary>` block (it renders via a React portal to `document.body` so it appears fixed at the bottom regardless of where in the tree it's placed).

### 2. `src/pages/FunLauncherPage.tsx` — Remove the inline stats strip
Delete the "Stats footer strip" `<div>` block (lines 386–403) — this is the non-sticky bar floating in the page content that should be removed.

## Result

- The proper sticky stats bar (TOKENS / AGENTS / FEES CLAIMED / AGENT POSTS / PAYOUTS + Connection indicator) will be fixed at the very bottom of every page.
- The duplicate inline floating version inside the launcher page will be gone.
