
# Fix: CrabClaws Not Showing in King of the Hill

## Issue Analysis

The CrabClaws token is **not appearing** in the King of the Hill section because it has `bonding_progress: 0`. This is **correct behavior** based on current logic - King of the Hill shows the top 3 tokens sorted by bonding progress (highest first), and CrabClaws has no trading activity yet.

### Current State:
- **CrabClaws (CRAB)**: `bonding_progress: 0`
- **Top 3 tokens**:
  1. MARIES: 5.2%
  2. KNGT: 1.2%
  3. SLAI: 0.8%

CrabClaws IS appearing in the main token list (sorted by creation date), just not in King of the Hill.

---

## Proposed Solution: Add "Just Launched" Section

Add a new prominently displayed section to showcase **recently launched tokens** (last 24 hours) regardless of their bonding progress. This ensures new tokens like CrabClaws get visibility immediately after launch.

### Implementation

**1. Create a new "JustLaunched" component**

File: `src/components/launchpad/JustLaunched.tsx`

```text
Component showing:
- Title: "Just Launched" with Rocket icon
- Horizontally scrolling cards of tokens created in the last 24 hours
- Each card shows: token image, name, ticker, market cap, age
- Sorted by created_at DESC (newest first)
- Limit to 10 tokens max
- Links to token detail page
```

**2. Update FunLauncherPage**

Add the JustLaunched component below the King of the Hill section:

```text
{/* King of the Hill */}
<KingOfTheHill />

{/* New: Just Launched */}
<JustLaunched tokens={tokens} />
```

**3. Component Structure**

```text
JustLaunched
├── Filter tokens created in last 24h
├── Sort by created_at (newest first)
├── Take first 10
├── Render horizontal scroll container
│   └── TokenCard (compact version)
│       ├── Image
│       ├── Name + Ticker
│       ├── Market Cap (USD)
│       └── "X minutes ago" timestamp
└── Show nothing if no recent tokens
```

---

## Technical Details

### New File: `src/components/launchpad/JustLaunched.tsx`

```typescript
// Props: tokens array from useFunTokens
// Filter: created_at > Date.now() - 24 hours
// Sort: created_at DESC
// Display: horizontal scroll with compact cards
// Link: agent tokens -> /t/:ticker, regular -> /launchpad/:mint
```

### Changes to `src/pages/FunLauncherPage.tsx`

- Import JustLaunched component
- Add after KingOfTheHill section (line ~282)

### Styling

- Uses existing gate-theme classes
- Horizontal scrollable container with hidden scrollbar
- Subtle border and hover effects
- Responsive: works on mobile and desktop

---

## Alternative Option: Modify King of the Hill Logic

If you'd prefer to modify King of the Hill instead:

```typescript
// Current logic:
.sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0))

// Alternative: Add recency tiebreaker
.sort((a, b) => {
  const progressDiff = (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0);
  if (Math.abs(progressDiff) < 0.001) {
    // Tiebreaker: newer tokens first when progress is similar
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }
  return progressDiff;
})
```

This would show newer tokens when bonding progress is essentially 0% for multiple tokens.

---

## Recommendation

The **"Just Launched" section** is recommended because:
1. Keeps King of the Hill semantically correct (tokens closest to graduation)
2. Gives immediate visibility to new tokens regardless of trading
3. Creates urgency for users to "get in early" on new launches
4. Clear separation of concerns (progress vs. recency)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/launchpad/JustLaunched.tsx` | **New file** - Just Launched component |
| `src/pages/FunLauncherPage.tsx` | Import and add JustLaunched section |
| `src/components/launchpad/index.ts` | Export JustLaunched component |
