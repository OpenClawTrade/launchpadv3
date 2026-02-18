
## Fix: Matrix Background Covering Page Content (Missing Tabs)

### Root Cause

The `MatrixBackground` canvas is `position: fixed` with `z-index: 0`. Page content in `.gate-theme` and other page wrappers has no explicit `z-index`, which means they sit in the default stacking context at `z-index: auto`. In CSS stacking rules, a `position: fixed` element with `z-index: 0` paints **on top of** in-flow content with no explicit z-index — this is why the Matrix rain canvas overlaps and hides tabs, content panels, and UI elements across all pages.

### The Fix

Change the canvas `z-index` from `0` to `-1` in `MatrixBackground.tsx`. This is the correct and minimal fix:

- `z-index: -1` places the canvas **below all page content** in every stacking context automatically
- No changes needed to any individual page or CSS file
- Pointer events are already `none`, so this has zero behavioral impact
- The canvas will still be visible through semi-transparent backgrounds (the dark page backgrounds have some transparency that lets the rain show through)

### Files Changed

| File | Change |
|---|---|
| `src/components/claw/MatrixBackground.tsx` | Change `style={{ zIndex: 0 }}` to `style={{ zIndex: -1 }}` on the canvas element |

### Why This Works

```text
Before:
  canvas (fixed, z-index: 0)  ← paints over auto-stacked content
  page content (z-index: auto = 0 but loses tie-break to positioned fixed)

After:
  page content (z-index: auto) ← always above
  canvas (fixed, z-index: -1)  ← always below all content
```

This is the standard pattern for background canvas effects and requires only a single character change.
