

## Plan: Fix Branding + Add "Launching 14th March" Popup on Stake

### Issues Found
1. **`src/pages/SaturnForumPage.tsx` line 239**: Says "Saturn Trading Agents" instead of "MoonDexo Trading Agents"
2. **Stake SOL buttons** across 3 files currently link to `/agents?strategy=...` — need to show a popup instead saying "Launching on 14th March"

### Changes

**1. Fix branding in `src/pages/SaturnForumPage.tsx`**
- Line 239: Change "Saturn Trading Agents" → "MoonDexo Trading Agents"

**2. Replace Stake links with "Launching 14th March" popup**

In these 3 locations, replace the `<Link>` Stake SOL buttons with `<button>` elements that trigger a toast/dialog saying "Launching on 14th March":

- **`src/pages/SaturnForumPage.tsx`** (lines 180-190) — FeaturedAgentCard stake CTA
- **`src/components/trading/TradingAgentsShowcase.tsx`** (lines 125-132) — Stake SOL button
- **`src/components/home/TradingAgentsShowcase.tsx`** (lines 141-149) — Stake SOL → button

Each button will call `toast.info("Launching on 14th March")` using the existing `sonner` toast library instead of navigating.

### Files to Edit
- `src/pages/SaturnForumPage.tsx` — branding fix + stake popup
- `src/components/trading/TradingAgentsShowcase.tsx` — stake popup  
- `src/components/home/TradingAgentsShowcase.tsx` — stake popup

