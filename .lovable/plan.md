

# Fix Navigation Tab Button Styling

## Problem
The Tokens/Promoted/Top/Claims/Creators tab buttons have poor visibility:
- Active tab has a very faint red that's hard to see
- Inactive tabs appear washed out with no clear styling
- The base `TabsTrigger` component has default `data-[state=active]` styles (white bg, shadow) that may conflict with the custom red theme

## Solution
Update the tab styling in `src/pages/FunLauncherPage.tsx` (lines 400-419):

1. **Active state** -- Make the red more prominent:
   - Stronger background: `bg-red-500/25` instead of `bg-red-500/20`
   - Brighter text: `text-red-300` instead of `text-red-400`
   - More visible border: `border-red-500/50` instead of `border-red-500/30`
   - Add a subtle red shadow glow for emphasis

2. **Inactive/default state** -- Make tabs more readable:
   - Use `text-gray-400` instead of `text-muted-foreground` so they're visible on the dark background
   - Add hover state: `hover:text-gray-200 hover:bg-white/5`

3. **Override base component defaults** -- Add `data-[state=active]:shadow-none data-[state=active]:bg-red-500/25` to ensure the base TabsTrigger active styles (white bg + shadow) don't override the red theme

## Technical Details

**File**: `src/pages/FunLauncherPage.tsx` (lines 400-419)

Each `TabsTrigger` className will be updated from:
```
data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 
data-[state=active]:border data-[state=active]:border-red-500/30 
text-muted-foreground text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2
```

To:
```
data-[state=active]:bg-red-500/25 data-[state=active]:text-red-300 
data-[state=active]:border data-[state=active]:border-red-500/50 
data-[state=active]:shadow-[0_0_12px_hsl(0,84%,60%,0.15)] 
text-gray-400 hover:text-gray-200 hover:bg-white/5 
text-xs sm:text-sm rounded-lg px-1 sm:px-2 py-2
```

All 5 tabs (Tokens, Promoted, Top, Claims, Creators) will receive the same updated styling.

