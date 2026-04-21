

## Fix top nav icons: invisible on dark bar + wrong X Tracker icon

Two bugs in `public/popshiba-template/launch.html` nav.

### Bug 1 — All icons except the active one are invisible
The nav bar background is `--ink` (near-black). The icon SVGs are styled with `stroke: var(--ink)` (also near-black) → dark-on-dark = invisible. Only the **active** Launchpad rocket shows because `.active .ni svg` switches stroke to `var(--primary)` (orange).

**Fix (CSS, lines 42–43):**
- Default stroke: `var(--cream)` (matches nav text color, fully visible).
- Hover/active stroke: `var(--primary)` (orange, kept as-is).
- Bump default opacity to `0.85` and hover/active to `1` so the active item still pops.

### Bug 2 — X Tracker uses the X (Twitter) logo
The X logo should be reserved for the actual social link in `.nav-right` (where it correctly leads to x.com/PopShiba_launch). Using it again for an internal "X Tracker" page is confusing.

**Fix (line 906):** Replace the X-cross SVG with a tracker/radar-style icon that matches the rest of the nav set (1.8 stroke, currentColor, line-art). Proposed glyph: a radar dish — concentric arcs + a sweep line — clearly reads as "tracker/monitor" and visually distinct from the Telegram/X social pills on the right.

```svg
<svg viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 12 L19 7"/>
  <path d="M5 12a7 7 0 0 1 7-7"/>
  <path d="M8.5 12a3.5 3.5 0 0 1 3.5-3.5"/>
</svg>
```

### Also worth doing while in there
- Verify each nav SVG renders cleanly at 20×20 after the stroke fix (Home, Pulse, Trade, Launchpad, Holders, Alpha, X Tracker, Docs). The Trade arrow paths (`M4 7h13l-3-3` / `M20 17H7l3 3`) are unclosed arrows — they'll read fine once visible.
- Mobile breakpoint (≤760px) and tablet breakpoint (761–980px) both already swap labels for icons, so once the stroke is fixed, all 8 icons will appear in the compact bar instead of just the rocket.

### Files
- `public/popshiba-template/launch.html` — CSS rule on lines 42–43, and the X Tracker `<a>` on line 906.

No contract, edge function, or React changes.

