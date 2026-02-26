
# Remove Matrix Background on Punch Domain

## Problem
On `punchlaunch.fun`, the homepage renders at `/` (not `/punch`), so the Matrix background suppression check (`pathname.startsWith("/punch")`) doesn't trigger. The green Matrix rain (a Claw Mode visual) bleeds into the Punch experience.

## Solution
Update the `ConditionalMatrixBackground` component in `src/App.tsx` to also check the hostname. If the visitor is on `punchlaunch.fun`, suppress the Matrix background entirely regardless of the route.

## Technical Details

**File: `src/App.tsx`** (lines 17-22)

Update `ConditionalMatrixBackground` to detect the punch domain and return null:

```typescript
function ConditionalMatrixBackground() {
  const { matrixEnabled } = useMatrixMode();
  const { pathname } = useLocation();
  const hostname = window.location.hostname;
  const isPunchDomain = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";
  if (!matrixEnabled || isPunchDomain || pathname.startsWith("/launchpad/") || pathname.startsWith("/punch") || pathname === "/trade") return null;
  return <MatrixBackground />;
}
```

This is a single-line domain check addition -- no other files need changes.
