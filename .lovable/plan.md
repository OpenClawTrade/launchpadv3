
# Fix: Remove Trailing Punctuation from Parsed Symbol/Ticker

## Problem
When launching the **Inverse Cramer Bitcoin ($CRAMER)** token, the SubTuna community URL was created as `https://tuna.fun/t/CRAMER,` with a trailing comma. This happened because the symbol parsing logic does not strip punctuation.

### Evidence
User posted something like:
```
!tunalaunch
name: Inverse Cramer Bitcoin,
symbol: CRAMER,
wallet: ...
```

The parser captured `CRAMER,` (with comma) because it only trims whitespace, not punctuation.

## Root Cause

In `supabase/functions/agent-process-post/index.ts`, line 215:
```typescript
data.symbol = trimmedValue.toUpperCase().slice(0, 10);
```

This only:
1. Trims whitespace (via `trimmedValue`)
2. Converts to uppercase
3. Limits to 10 characters

It does NOT remove trailing punctuation like `,`, `.`, `!`, etc.

## Solution

Add punctuation cleanup for the symbol/ticker field before storing:

```typescript
case "symbol":
case "ticker":
  // Remove any non-alphanumeric characters (ticker should only be letters/numbers)
  const cleanSymbol = trimmedValue.replace(/[^a-zA-Z0-9]/g, "");
  data.symbol = cleanSymbol.toUpperCase().slice(0, 10);
  break;
```

This regex removes **all non-alphanumeric characters** from the ticker, ensuring:
- `CRAMER,` → `CRAMER`
- `$CRAMER` → `CRAMER`  
- `CRAMER.` → `CRAMER`
- `!CRAMER!` → `CRAMER`

## Files to Modify

1. **`supabase/functions/agent-process-post/index.ts`**
   - Update the `assignParsedField` function to clean the symbol/ticker

2. **`supabase/functions/agent-launch/index.ts`** (optional)
   - Add same validation for API-based launches (already uses `.slice(0, 10)` at line 244, could add same cleanup)

## Additional Improvements

### Also clean the name field
Apply similar cleanup to remove trailing commas from token names:
```typescript
case "name":
case "token":
  // Remove trailing punctuation from name
  const cleanName = trimmedValue.replace(/[,.:;!?]+$/, "");
  data.name = cleanName.slice(0, 32);
  break;
```

This would turn `Inverse Cramer Bitcoin,` → `Inverse Cramer Bitcoin`

## Summary
| Field | Before | After |
|-------|--------|-------|
| symbol | `trimmedValue.toUpperCase().slice(0, 10)` | `trimmedValue.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10)` |
| name | `trimmedValue.slice(0, 32)` | `trimmedValue.replace(/[,.:;!?]+$/, "").slice(0, 32)` |

This ensures cleaner, more reliable parsing of social media posts where users often add trailing punctuation.
