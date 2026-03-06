

## Move Quick Buy Header to Top of Page

The P1/P2/P3 quick-buy header bar and online indicator are currently below "Just Launched." They need to be moved above King of the Hill so they sit at the very top of the main content area, allowing global quick-buy configuration for all token cards.

### Change in `src/pages/FunLauncherPage.tsx`

Reorder the sections inside `<main>` (lines 208-341) to:

1. **Online indicator** (currently lines 281-286) — move to top
2. **Quick Buy Header bar** (currently lines 289-320, the P1/P2/P3 bar only, NOT the token grid) — move right below online indicator
3. **King of the Hill** (stays, currently lines 211-213)
4. **Just Launched** (stays, currently lines 215-278)
5. **Token Grid** (the grid portion only, lines 322-338, wrapped in its own `px-4 pb-16` div)

This is purely a reorder of existing JSX blocks within the same component. No logic changes needed.

