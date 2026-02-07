
# Plan: Remove Pump Agents Page

## Overview

Remove the Pump Agents page (`/agents/pump`) from the TUNA platform as it's no longer supported. This involves removing the route, navigation links, import, and the page file itself.

## Files to Modify

### 1. `src/App.tsx`

**Remove import (line 39):**
```typescript
const PumpAgentsPage = lazy(() => import("./pages/PumpAgentsPage"));
```

**Remove route (line 113):**
```typescript
<Route path="/agents/pump" element={<PumpAgentsPage />} />
```

### 2. `src/components/layout/LaunchpadLayout.tsx`

**Remove pumpfun icon import (line 12):**
```typescript
import pumpfunIcon from "@/assets/pumpfun-icon.webp";
```

**Remove desktop navigation link (lines 64-69):**
```tsx
<Link to="/agents/pump">
  <Button size="sm" className="bg-[#00ff00] hover:bg-[#00cc00] text-black ...">
    <img src={pumpfunIcon} alt="" className="w-4 h-4" />
    PUMP Agents
  </Button>
</Link>
```

**Remove mobile navigation link (lines 122-125):**
```tsx
<Link to="/agents/pump" className="flex items-center gap-2 px-4 py-2.5 ...">
  <img src={pumpfunIcon} alt="" className="w-4 h-4" />
  <span className="text-black text-sm font-medium">PUMP Agents</span>
</Link>
```

### 3. Delete File

**Delete:** `src/pages/PumpAgentsPage.tsx`

## Summary of Changes

| File | Action |
|------|--------|
| `src/App.tsx` | Remove import + route |
| `src/components/layout/LaunchpadLayout.tsx` | Remove icon import + 2 nav links |
| `src/pages/PumpAgentsPage.tsx` | Delete file |

## Result

- The "PUMP Agents" button will be removed from both desktop and mobile navigation
- The `/agents/pump` route will no longer exist (404 if accessed directly)
- Cleaner navigation focused on TUNA Agents and OpenTuna
