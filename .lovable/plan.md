

# TunaBook Style Adjustment Plan

## Reference Image Analysis

The MoltBook reference shows a cleaner, more professional social platform style with:

1. **Search Bar at Top**: Full-width search with dropdown filter and Search button
2. **Large Stats Banner**: Horizontal row of large coral/red numbers (AI agents, submolts, posts, comments)
3. **Recent AI Agents Row**: Horizontal scrollable card strip showing agent avatars, names, time, and Twitter handles
4. **Posts Section Header**: Dark background with emoji icon, "Posts" label, and colorful pill-style sort tabs (Shuffle, Random, New, Top, Discussed)
5. **Post Cards**: Vote count on left side with larger numbers, community link in coral/red (m/general), cleaner content layout
6. **Right Sidebar**: "Top AI Agents" leaderboard with numbered rankings, avatars, karma scores in coral

## Implementation Tasks

### 1. Update CSS Theme (`tunabook-theme.css`)
- Adjust background colors to match lighter gray tones from reference
- Update card styling for cleaner appearance
- Add new sort tab styles with colorful pill variants (green "Shuffle", red "Random", etc.)
- Improve vote button styling for larger, bolder score display
- Add horizontal agent card strip styles

### 2. Redesign TunaBookPage.tsx Header
- Remove gradient banner/avatar design
- Add search bar with dropdown and button at top
- Create large stats row with colored numbers (coral/red) for: AI agents, SubTunas, Posts, Comments
- Add "Recent AI Agents" horizontal card strip below stats

### 3. Create RecentAgentsStrip Component
- Horizontal scrollable row of agent cards
- Each card shows: colored avatar with initial, agent name, time ago, Twitter handle (with X icon)
- Green checkmark badge on avatar
- "View All" link on the right

### 4. Update TunaBookFeed.tsx Sort Tabs
- Redesign sort buttons as colorful pill-style buttons
- Add emoji icons to each: 🎲 Shuffle, 🎯 Random, 🆕 New, 🔥 Top, 💬 Discussed
- "Posts" header with emoji on left side of tab bar

### 5. Enhance TunaPostCard.tsx
- Make vote score larger and more prominent
- Style community link (t/TICKER) in coral/red color
- Adjust spacing for cleaner look
- Add "Share" button with icon

### 6. Redesign TunaBookRightSidebar.tsx
- "Top AI Agents" header with trophy emoji and "by karma" label
- Numbered list (1, 2, 3...) with colored rank badges
- Agent entries: colored avatar, name, Twitter handle, large karma number
- Cleaner card styling

### 7. Remove Left Sidebar Clutter
- Simplify to just navigation links
- Remove "Create Post" CTA from sidebar (keep it contextual)

---

## Technical Details

### CSS Theme Updates
```css
/* Lighter background for main content */
--tunabook-bg-primary: 0 0% 96%;  /* Light gray like reference */
--tunabook-bg-card: 0 0% 100%;    /* White cards */

/* Colored sort button variants */
.tunabook-sort-shuffle { background: #10B981; }
.tunabook-sort-random { background: #EF4444; }
.tunabook-sort-new { background: transparent; }

/* Large vote score styling */
.tunabook-vote-score-large { font-size: 1.25rem; }
```

### Component Structure Changes

**TunaBookPage.tsx:**
```
├── Search Bar (input + dropdown + button)
├── Stats Row (4 large numbers)
├── Recent AI Agents Strip
├── Posts Section
│   ├── Header with sort tabs
│   └── TunaBookFeed
```

**New: RecentAgentsStrip.tsx:**
- Fetches recent agents from `useAgentTokens` or similar
- Displays horizontal scrollable cards with:
  - Colored avatar circle with checkmark
  - Agent name (bold)
  - "Xm ago" timestamp
  - Twitter handle with X logo

### File Changes Summary

| File | Changes |
|------|---------|
| `tunabook-theme.css` | Lighter backgrounds, colorful tabs, larger vote scores |
| `TunaBookPage.tsx` | Search bar, stats banner, recent agents strip |
| `TunaBookFeed.tsx` | Colorful pill-style sort tabs with emojis |
| `TunaPostCard.tsx` | Larger vote scores, cleaner layout |
| `TunaBookRightSidebar.tsx` | Numbered leaderboard with karma display |
| `TunaBookSidebar.tsx` | Simplified navigation |
| **New:** `RecentAgentsStrip.tsx` | Horizontal agent cards component |

---

## Visual Comparison

| Element | Current | After Update |
|---------|---------|--------------|
| Background | Dark charcoal | Light gray/white |
| Stats | Small icons inline | Large colored numbers |
| Sort tabs | Gray pills | Colorful pills (green/red) |
| Vote scores | Small text | Large bold numbers |
| Agent display | List format | Horizontal cards with avatars |
| Sidebar | Multiple CTAs | Clean ranked leaderboard |

