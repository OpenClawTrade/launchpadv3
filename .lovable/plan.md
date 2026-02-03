
# Fix: Ticker Corruption with "HTTPS" Text

## Problem
Token tickers are being corrupted with "HTTPS" or "HTTPST" appended to them:
- `$RATESHTTPS` (should be `$RATES`)
- `$WLFNHTTPST` (should be `$WLFN`)
- `$THNKHTTPST` (should be `$THNK`)

## Root Cause
In `supabase/functions/agent-process-post/index.ts`, the ticker parsing has a bug:

1. When parsing tweet content like `symbol: WLFN https://t.co/abc123`, the URL stripping regex only matches URLs at the **end** of the value:
   ```typescript
   value = value.replace(/https?:\/\/\S+$/i, "").trim();
   ```

2. If the URL appears mid-value or the content has multiple URLs, they aren't stripped

3. Then `assignParsedField` removes non-alphanumeric characters:
   ```typescript
   data.symbol = trimmedValue.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
   ```
   
4. This turns `WLFN https://t.co/...` → removes `:` and `/` → `WLFNhttpstco...` → sliced to 10 chars → `WLFNHTTPST`

## Solution
Fix the URL stripping to remove ALL URLs from ticker/symbol values before processing, not just trailing ones.

### File Changes

**`supabase/functions/agent-process-post/index.ts`**

**Change 1:** Update `assignParsedField` for symbol/ticker case (around line 369-374):

Before:
```typescript
case "symbol":
case "ticker":
  // Remove ALL non-alphanumeric characters (ticker should only be letters/numbers)
  data.symbol = trimmedValue.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
  break;
```

After:
```typescript
case "symbol":
case "ticker":
  // First, strip ALL URLs from the value (not just trailing ones)
  // Then remove ALL non-alphanumeric characters (ticker should only be letters/numbers)
  const cleanedTicker = trimmedValue
    .replace(/https?:\/\/\S+/gi, "")  // Remove ALL URLs, not just trailing
    .replace(/[^a-zA-Z0-9]/g, "")      // Remove non-alphanumeric
    .toUpperCase()
    .slice(0, 10);
  data.symbol = cleanedTicker;
  break;
```

**Change 2 (optional but recommended):** Also update the name parsing to be safe (around line 364-368):

Before:
```typescript
case "name":
case "token":
  data.name = trimmedValue.replace(/[,.:;!?]+$/, "").slice(0, 32);
  break;
```

After:
```typescript
case "name":
case "token":
  // Strip URLs first, then trailing punctuation
  const cleanedName = trimmedValue
    .replace(/https?:\/\/\S+/gi, "")  // Remove ALL URLs
    .trim()
    .replace(/[,.:;!?]+$/, "")        // Remove trailing punctuation
    .slice(0, 32);
  data.name = cleanedName;
  break;
```

## Database Fix (Optional)
After deploying the fix, we can also clean up the corrupted tokens in the database:

```sql
-- Preview corrupted tokens
SELECT id, ticker, name FROM fun_tokens 
WHERE ticker LIKE '%HTTP%'
ORDER BY created_at DESC;

-- Fix corrupted tickers by stripping HTTP* suffix
UPDATE fun_tokens 
SET ticker = REGEXP_REPLACE(ticker, 'HTTP.*$', '', 'g')
WHERE ticker LIKE '%HTTP%';
```

## Summary

| What | Change |
|------|--------|
| Root cause | URL stripping regex only matches trailing URLs |
| Fix | Strip ALL URLs from ticker values before processing |
| Files | `supabase/functions/agent-process-post/index.ts` |
| Impact | Prevents future ticker corruption from tweets with URLs |
