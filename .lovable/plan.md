
# Fix Duplicate Icons - Show Only One Badge per Token

## Problem
Pump.fun tokens currently display **both** the purple "AI" bot badge AND the green pump.fun pill badge. The user wants these to be mutually exclusive - only one icon should appear.

## Solution
Update the badge logic to be mutually exclusive:
- **Pump.fun tokens** → Show only the PumpBadge (green pill)
- **Agent tokens (not pump.fun)** → Show only the AI Bot badge  
- **Regular tokens** → Show neither badge

## Files to Modify

### 1. `src/components/launchpad/TokenCard.tsx`

Change the conditional logic from showing both badges to mutually exclusive:

**Current logic (lines 116-129):**
```tsx
{/* AI Agent badge - shows for agent_id OR isPumpFun */}
{(token.agent_id || isPumpFun) && (
  <span>...</span>
)}
{/* pump.fun badge - shows for isPumpFun */}
{isPumpFun && (
  <PumpBadge ... />
)}
```

**New logic:**
```tsx
{/* pump.fun badge - takes priority */}
{isPumpFun ? (
  <PumpBadge mintAddress={token.mint_address} />
) : token.agent_id ? (
  <span className="flex items-center gap-0.5 bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full" title="AI Agent Token">
    <Bot className="h-3 w-3" />
    <span className="text-[10px] font-medium">AI</span>
  </span>
) : null}
```

### 2. `src/components/launchpad/JustLaunched.tsx`

Add `launchpad_type` to the Token interface and implement the same mutually exclusive badge logic:

**Add to interface:**
```tsx
interface Token {
  // ... existing fields
  launchpad_type?: string | null;
}
```

**Update badge logic in JustLaunchedCard:**
```tsx
{token.launchpad_type === 'pumpfun' ? (
  <PumpBadge size="sm" showText={false} mintAddress={token.mint_address} />
) : token.agent_id ? (
  <Bot className="w-3 h-3 text-purple-400 flex-shrink-0" />
) : null}
```

## Result

| Token Type | Badge Shown |
|------------|-------------|
| Pump.fun token | Green pump pill only |
| Agent token (TUNA launchpad) | Purple AI bot only |
| Regular token | No badge |

This ensures visual clarity and prevents icon clutter.
