
## Full pump.fun-Style Redesign — Complete Layout & Visual Overhaul

### The Core Problem (What's Actually Wrong)

Comparing the pump.fun screenshot to the current site reveals **two fundamental structural differences** that no amount of CSS tweaking will fix:

**1. Layout Architecture:**
- **pump.fun**: Fixed left sidebar (140px wide) with logo, nav links, and "Create coin" CTA button — main content fills the right 100%
- **Current site**: Top horizontal header bar with all navigation crammed into it

**2. Main Content Layout:**
- **pump.fun**: Full-width token grid (4 columns) with large thumbnail cards showing token image prominently. "Trending coins" horizontal scroll at top. Filter tabs below.
- **Current site**: Split layout with launcher form on the left (340px) + tabbed token table on the right. King of the Hill and Just Launched stacked above. Stats ribbon.

**3. Token Cards:**
- **pump.fun**: Large 180px-wide cards with big image (covers ~60% of card), token name, ticker, MC, description text below — GRID LAYOUT
- **Current site**: Ultra-compact row-list in 3 columns (New Pairs / Almost Bonded / Bonded)

**4. Color Theme:**
- **pump.fun**: True black `#141414` background, cards `#1a1a1a` — very subtle dark gray differences. GREEN `#4ade80` as primary accent (not red). Nav background `#1a1a1a`.
- **Current site**: Near-black with red accent `#e84040`

---

### What Will Be Built

The redesign keeps ALL existing data hooks, logic, and features — only the visual shell and layout changes.

**New Layout (Left Sidebar + Right Content):**
```text
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR (w-36)  │  MAIN CONTENT (flex-1)               │
│                 │                                        │
│ 🦞 Claw Mode   │  [Search bar]      [Create] [Sign In] │
│                 │  ─────────────────────────────────── │
│ 🏠 Home         │  🔥 Trending Coins (horizontal scroll) │
│ 📺 Livestreams  │  ─────────────────────────────────── │
│ 📊 Terminal     │  [Boosted ●][Live][New][MC][Replies]  │
│ 💬 Agents       │                                        │
│ ⚙️  SDK          │  Token Grid (4 cols):                  │
│ 📦 Migrate      │  [img][img][img][img]                  │
│                 │  [img][img][img][img]                  │
│ [Create Token]  │  ...                                   │
│                 │                                        │
│ [App QR / Claw] │                                        │
└─────────────────────────────────────────────────────────┘
```

---

### Part 1 — Global Layout: Add Left Sidebar

**New file: `src/components/layout/Sidebar.tsx`**

A fixed left sidebar (136px wide on desktop, slide-out on mobile) replacing the top nav:

- Logo at top: lobster icon + "Claw Mode" text in green
- Nav links with icons: Home (🏠), Livestreams (📺), Terminal (📊), Chat (💬), Agents (🤖), SDK (⚙), Migrate (↔)
- **"Create Token"** green button at bottom (primary CTA — matches pump.fun's green "Create coin" button)
- User wallet / sign-in at bottom
- Background: `#1a1a1a` with `#2a2a2a` border-right
- Nav link active state: green left border + lighter background

---

### Part 2 — Root Layout Wrapper

**Update `src/App.tsx` or create `src/components/layout/RootLayout.tsx`**

Wrap all pages in a flex layout:
```tsx
<div className="flex min-h-screen bg-[#141414]">
  <Sidebar />  {/* w-36 fixed left */}
  <div className="flex-1 ml-36 flex flex-col">
    <TopBar />  {/* search + wallet connect — replaces header */}
    <main>{children}</main>
  </div>
</div>
```

The current `AppHeader` gets replaced with a thin `TopBar` (search + wallet row).

---

### Part 3 — TopBar (Search + Wallet Row)

**Update `src/components/layout/AppHeader.tsx`** → becomes a slim top bar:

- Left: Search input (full-width dark input, placeholder "Search for token")
- Right: X icon button + **"Create Token"** green button + **"Sign In"** outline button
- Background: `#141414`, border-bottom: `1px solid #2a2a2a`
- Height: 52px

---

### Part 4 — FunLauncherPage.tsx — Complete Restructure

The home page becomes a pure token discovery page (no left launcher form — moved to its own Create page):

**New structure:**
1. **Trending Coins** horizontal scroll — large cards (180×220px) with:
   - Full image taking top 60%
   - MC overlay on image bottom-left
   - Token name + ticker below image
   - Description text (1 line, truncated)

2. **Filter Tabs Row** (flat underline style):
   - `Boosted ●` | `Live` | `New` | `Market Cap` | `Replies` | `Last Trade`
   - Plus "Filter" button and grid/list view toggle on the right

3. **Token Grid** (4 columns, responsive):
   - Cards matching pump.fun style: large image, MC, name, ticker, description
   - Image aspect ratio ~1:1 with rounded corners
   - Hover state: slight scale + border glow

**The token launcher** (create form) moves to the route `/create` and appears in the sidebar nav CTA.

---

### Part 5 — Token Card Component

**New file: `src/components/launchpad/TokenCard.tsx`** (replace current compact row style):

```
┌────────────────────────┐
│  [Large Token Image]   │  ← ~180px height
│  $1.05M    [LIVE]      │  ← overlaid on image bottom
├────────────────────────┤
│  Token Name    TICKER  │
│  Description text ...  │  ← truncated 2 lines
└────────────────────────┘
```

- Background: `#1a1a1a`
- Border: `1px solid #2a2a2a`
- Border radius: `8px`
- On hover: border color → `#4ade80` (green), slight scale 1.01

---

### Part 6 — Color System Update

**Update `src/index.css` dark mode variables:**

| Variable | Current | New (pump.fun) |
|---|---|---|
| `--background` | `0 0% 2%` | `0 0% 8%` (`#141414`) |
| `--card` | `240 8% 4%` | `0 0% 10%` (`#1a1a1a`) |
| `--border` | `240 8% 11%` | `0 0% 16%` (`#2a2a2a`) |
| `--primary` | `0 84% 60%` (RED) | `142 69% 58%` (GREEN `#4ade80`) |
| `--muted-foreground` | slate | `0 0% 50%` muted gray |

Note: The lobster logo and "Claw Mode" brand stays — only the accent color shifts from red to green to match pump.fun's aesthetic. (Or we can keep red if user prefers — but pump.fun is definitively green.)

---

### Part 7 — Sidebar Navigation on All Pages

All existing pages (`TradePage`, `TunaBookPage`, `WhitepaperPage`, `CareersPage`, etc.) will inherit the sidebar via the root layout wrapper. No per-page header duplication needed.

Current `AppHeader` usage in individual pages (`FunLauncherPage`, `TradePage`, `TokenDetailPage`, `FunTokenDetailPage`) gets removed — the root layout handles it.

---

### Part 8 — Mobile Responsive

On mobile (`< 768px`):
- Sidebar hidden by default
- Hamburger button in TopBar opens drawer (slide-in from left)
- Token grid becomes 2-column (or 1-column on very small screens)
- Trending scroll stays horizontal

---

### Part 9 — King of the Hill + Just Launched

Instead of separate sections above the grid, these become **filter tabs** in the main token grid:
- `New` tab = Just Launched tokens
- `Top` tab = King of the Hill tokens (by bonding progress / MC)
- `Live` tab = tokens with active agents

This matches pump.fun's tab approach and eliminates the cluttered stacked sections.

---

### Part 10 — Stats Strip

The current stats ribbon becomes a small footer bar or gets moved into the sidebar bottom section (platform stats: X tokens launched, X agents active).

---

### Files to Create/Modify

| Action | File | Change |
|---|---|---|
| CREATE | `src/components/layout/Sidebar.tsx` | New left sidebar nav |
| MODIFY | `src/components/layout/AppHeader.tsx` | → slim TopBar (search + wallet) |
| MODIFY | `src/App.tsx` | Wrap routes in sidebar layout |
| MODIFY | `src/pages/FunLauncherPage.tsx` | Full restructure → pump.fun grid layout |
| MODIFY | `src/components/launchpad/TokenTable.tsx` | → pump.fun card grid |
| MODIFY | `src/components/launchpad/KingOfTheHill.tsx` | Remove as separate section → merge into tabs |
| MODIFY | `src/components/launchpad/JustLaunched.tsx` | Remove as separate section → merge into tabs |
| MODIFY | `src/index.css` | Update color variables (background, card, border, primary) |
| MODIFY | `src/styles/gate-theme.css` | Strip Gate.io legacy classes |
| MODIFY | `src/components/launchpad/StatsCards.tsx` | Move to sidebar bottom |

### What Does NOT Change
- All data hooks (`useFunTokensPaginated`, `useKingOfTheHill`, `useJustLaunched`, etc.)
- Supabase queries and backend calls
- Token detail pages (TradePage, TokenDetailPage, FunTokenDetailPage)
- All modal logic (LaunchResult, PromoteModal)
- All agent pages, whitepaper, careers, SDK pages
- Route definitions in App.tsx
