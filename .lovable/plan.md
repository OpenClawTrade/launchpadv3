
## Fix FunTokenDetailPage Crash — Null creator_wallet

### Root Cause

The page crashes immediately on load with:
```
TypeError: Cannot read properties of null (reading 'slice')
```

The network response for this token shows `"creator_wallet": null`. Line 247 of `FunTokenDetailPage.tsx` does this without a null check:

```tsx
{token.creator_wallet.slice(0, 6)}...{token.creator_wallet.slice(-4)}
```

When `creator_wallet` is `null`, calling `.slice()` throws and crashes the entire page, triggering the ErrorBoundary.

### All Unguarded `.slice()` Calls to Fix

A full audit of the file reveals these need guarding:

| Line | Code | Risk |
|---|---|---|
| 182 | `token.ticker.slice(0, 2)` | Low — ticker should always exist, but defensive |
| 209 | `token.ticker.slice(0, 2)` | Same |
| 247 | `token.creator_wallet.slice(0, 6)` | **CRASH** — creator_wallet IS null for this token |
| 248 | `token.creator_wallet.slice(-4)` | **CRASH** — same field |

### Fix

**`src/pages/FunTokenDetailPage.tsx` — line 244–249**

Replace the "Created by" block from:
```tsx
<p className="text-sm text-muted-foreground mt-1">
  Created by <span className="font-medium text-foreground">
    {token.creator_wallet.slice(0, 6)}...{token.creator_wallet.slice(-4)}
  </span>
</p>
```

To:
```tsx
<p className="text-sm text-muted-foreground mt-1">
  Created by <span className="font-medium text-foreground">
    {token.creator_wallet 
      ? `${token.creator_wallet.slice(0, 6)}...${token.creator_wallet.slice(-4)}`
      : 'Unknown'}
  </span>
</p>
```

Also guard the ticker fallback `.slice()` calls at lines 182 and 209 with `(token.ticker || '??').slice(0, 2)` for defensive safety.

### What This Fixes

- The page will load correctly for all tokens, whether or not they have a `creator_wallet`
- Tokens without a creator wallet show "Unknown" instead of crashing
- No data, layout, or logic changes — purely defensive null handling
- One file changed: `src/pages/FunTokenDetailPage.tsx`
