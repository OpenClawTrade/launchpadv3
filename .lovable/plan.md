

## Plan: Move Create Token "+" Button Higher Above Footer

### Problem
The green "+" Create Token button at the bottom of the desktop sidebar sits too low — it overlaps with or sits too close to the 40px `StickyStatsFooter`. The sidebar currently uses `pb-14` (56px) bottom padding on the container, but the button still appears to be inside the footer zone.

### Fix
In `src/components/layout/Sidebar.tsx`, increase the bottom padding on the Create Token CTA container from `pb-14` to `pb-20` (80px) on desktop. This gives enough clearance above the 40px footer while keeping the button accessible.

**File:** `src/components/layout/Sidebar.tsx` (line 119)
- Change `pb-14` → `pb-20` to push the "+" button comfortably above the footer bar.

Single-line change, no other files affected.

