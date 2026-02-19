
## Full Head-to-Toe Visual Redesign — "Claw Mode" Dark Terminal

### What's Wrong Right Now

The screenshot shows the site still looks like the original Gate.io exchange template:
- Rectangular stat cards with large padded numbers
- Standard section headers ("King of the Hill", "Just Launched") centered like a blog
- The token table uses a 3-column card grid layout — not a compact trading terminal
- Header nav uses colored button pills (Trade, Agents, Claw SDK, Migrate) in a noisy bar
- The ticker bar looks like a simple exchange price feed
- The whole page uses the same generic card/table structure as the old template
- `gate-theme.css` (1,003 lines) is the root of the old design — it still controls everything

The reference images show a **Photon/Bullx-style dark trading terminal**: ultra-compact rows, full-width token feed, minimal decorative elements, and the launcher form tightly integrated left-side.

---

### Strategy

Instead of patching individual components, this redesign works at 3 levels simultaneously:

1. **`gate-theme.css`** — Completely rewrite the visual variables and base styles to a true dark terminal look (pure black, tighter spacing, sharper borders, red glow accent)
2. **`src/index.css`** — Reinforce the root dark body, add Claw Mode specific utility classes
3. **Key page components** — Rebuild the visual shell of `FunLauncherPage.tsx`, `AppHeader.tsx`, `StatsCards.tsx`, `KingOfTheHill.tsx`, `JustLaunched.tsx`, `TokenTable.tsx`, and `TokenTickerBar.tsx`

---

### Part 1 — `src/styles/gate-theme.css` — Complete Rewrite

The current file is a 1,003-line Gate.io-inspired stylesheet. It will be fully replaced with a Claw Mode dark terminal theme.

**Key visual changes:**

| Property | Old (Gate.io) | New (Claw Terminal) |
|---|---|---|
| Background | `hsl(240 20% 4%)` soft dark | `#0a0a0a` pure black |
| Cards | Rounded, padded white cards | Sharp-edged dark panels `#111114` |
| Border | `hsl(240 15% 14%)` subtle | `#1e1e24` thin neon-adjacent |
| Primary accent | Red `0 84% 60%` | Red `#e84040` with glow |
| Header height | 42px compact | 48px, borderless glass |
| Table cells | 14px, 14px padding | 12px, 8px padding — ultra compact |
| Stat cards | Large 24px numbers | Small 18px with mini label above |
| Scrollbar | 6px thumb | 3px thread-thin thumb |
| Radius | `--gate-radius-lg: 14px` | `6px` flat panels — no heavy rounding |

The nebula gradient stays but becomes darker/more subtle.

---

### Part 2 — `src/components/layout/AppHeader.tsx` — Redesign

**Current**: Buttons with filled background colors (Trade=red, Agents=red, Claw SDK=green, Migrate=green). Cluttered nav.

**New design:**
- Flat nav links — no filled buttons, just text with underline-on-hover
- Active page gets a `border-b-2 border-primary` indicator
- The lobster logo gets `h-7 w-7` with no rounded border — raw icon
- Brand name `Claw Mode` in `font-mono` with lobster red tint
- Right side: X icon, SOL price chip (dark pill), and wallet connect button (red outline)
- Header background: `bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1e1e24]`
- Remove all colored button pills from the nav

---

### Part 3 — `src/components/launchpad/TokenTickerBar.tsx` — Redesign

**Current**: Standard horizontal scroll bar with token name + % change, using Gate.io styles.

**New design:**
- Background: solid `#111114` strip, 1px bottom border `#1e1e24`
- Each item: `font-mono text-[11px]`, tighter gap
- Positive: bright green `#00d26a`, Negative: `#e84040`
- Add a vertical `|` separator between items
- Ticker items use uppercase symbols only

---

### Part 4 — `src/components/launchpad/KingOfTheHill.tsx` — Redesign

**Current**: 3 large cards in a grid with big rounded avatars and centred "King of the Hill" heading.

**New design:**
- Section label: LEFT-aligned, small ALL-CAPS `KING OF THE HILL` with `🔥` emoji and thin separator line
- Cards: ultra-compact horizontal rows stacked in a single dark panel
  - 28px avatar | name + ticker | progress bar | MC value | age
- Rank badge: tiny `#1` `#2` `#3` chips in left-edge of the row
- No more large `hover:scale-[1.02]` hover — just subtle `bg-[#1a1a20]` on hover
- Panel: `bg-[#111114] border border-[#1e1e24] rounded-md`

---

### Part 5 — `src/components/launchpad/JustLaunched.tsx` — Redesign

**Current**: Horizontal scroll of 160px wide cards with large avatar and text.

**New design:**
- Same horizontal scroll but cards become **tighter**: `w-[140px]`, `p-2`, avatar `32px`
- Card background: `bg-[#111114] border border-[#1e1e24]`  
- Section header: LEFT-aligned `JUST LAUNCHED` with `🚀` and time label
- Token name truncated to 1 line, ticker below, MC in green, age right-aligned
- Cards pop slightly on hover with `border-primary/40`

---

### Part 6 — `src/components/launchpad/StatsCards.tsx` — Redesign

**Current**: 5 large cards in a grid with big 24px stat values.

**New design:**
- Replace with a single horizontal dark stat bar (like a trading platform info ribbon)
- `flex flex-row` across full width, `gap-0`, separated by vertical dividers
- Each stat: icon + label (11px muted) + value (14px bold white) all inline
- No card borders, just one unified dark `bg-[#111114] border-y border-[#1e1e24]` strip
- Compact, no wasted vertical space

---

### Part 7 — `src/components/launchpad/TokenTable.tsx` — Redesign

**Current**: 3-column grid (New Pairs / Almost Bonded / Bonded) with cards.

**New design** (matching Photon/Bullx reference):
- Keep the 3-column layout but make columns **borderless panels** with visible header row
- Column headers: `NEW PAIRS ●` `ALMOST BONDED ●` `BONDED ●` — colored dots, ALL CAPS, smaller text
- Each token row: ultra-compact `h-10` rows
  - `28px` avatar | name `font-semibold text-[12px]` + ticker `text-[10px] muted` | progress bar `h-0.5` | MC `text-[11px] font-mono text-green-400` | `+X%` colored | holders `muted` | hover: `[Buy]` pill
- No Progress bar below the name — integrate it as a thin 1px line at bottom of the row
- Rows alternating `bg-[#111114]` / `bg-[#0f0f12]` (zebra)
- Quick buy button appears on row hover, right-edge, `text-[10px] px-1.5 h-5`

---

### Part 8 — `src/pages/FunLauncherPage.tsx` — Layout Shell Redesign

**Current**: The page wraps everything in `gate-theme dark`, with large padded `max-w-[1400px]` sections.

**New design changes:**
- Reduce horizontal padding: `px-2 sm:px-4` (tighter)
- Remove the `gate-theme` wrapper class — apply Claw Mode styles directly through CSS variables
- The countdown banner redesigned: slim `h-8` red glowing strip, centered monospace text
- Tab list redesigned: flat `border-b border-[#1e1e24]` underline tabs (not pill tabs) — pure text, active gets red underline
- Section spacing reduced from `py-6 space-y-6` to `py-2 space-y-3`
- The left launcher panel stays at `w-[340px]`

---

### Part 9 — `src/index.css` — Root Utility Additions

Add Claw Mode-specific utility classes:

```css
/* Claw Mode terminal utilities */
.claw-panel { background: #111114; border: 1px solid #1e1e24; }
.claw-panel-dark { background: #0d0d10; border: 1px solid #1e1e24; }
.claw-text-green { color: #00d26a; }
.claw-text-red { color: #e84040; }
.claw-text-mono { font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
.claw-row-hover:hover { background: #1a1a20; }
.claw-glow-red { box-shadow: 0 0 12px rgba(232, 64, 64, 0.2); }
```

Update CSS comments from "TUNA Design System" / "Gate.io Inspired" to "Claw Mode Design System".

---

### Part 10 — `TunaPulse.tsx` Reference Fix

`src/components/launchpad/TunaPulse.tsx` — likely still has TUNA text in its component. Rename display text to "Claw Pulse" or similar.

---

### Execution Order

```text
1. Rewrite src/styles/gate-theme.css (dark terminal variables + base styles)
2. Update src/index.css (utility classes + comment cleanup)
3. Redesign AppHeader.tsx (flat nav, cleaner header)
4. Redesign StatsCards.tsx (horizontal info ribbon)
5. Redesign KingOfTheHill.tsx (compact rows)
6. Redesign JustLaunched.tsx (tighter cards)
7. Redesign TokenTickerBar.tsx (mono style)
8. Redesign TokenTable.tsx (ultra-compact rows)
9. Update FunLauncherPage.tsx layout shell (tabs, spacing)
10. Fix TunaPulse.tsx text reference
```

### What WON'T Change

- All data hooks, API calls, Supabase queries — zero changes
- The `TokenLauncher.tsx` form (2,891 lines) — functional logic untouched, only wrapper styles change via CSS
- Route definitions, navigation paths
- All modal functionality (LaunchResult modal, PromoteModal, etc.)
- All existing features (King of the Hill data, Just Launched data, Claims, Creators tabs)

### Result

After this redesign, a first-time visitor will see:
- Pitch-black background with razor-sharp dark panels
- Ultra-compact token feed that fills the screen like a trading terminal
- Red/coral accent on interactive elements with subtle glow
- Monospace numbers for prices and stats
- No signs of the original Gate.io exchange template
