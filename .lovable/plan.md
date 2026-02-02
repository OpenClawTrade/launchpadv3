
# Fix: Complete Sanitization for Token Launch Data (Name, Symbol, and Socials)

## Problem Summary

The **$CRAMER** token was launched with multiple data issues:
1. **Ticker has trailing comma**: `CRAMER,` instead of `CRAMER`
2. **Name has trailing comma**: `Inverse Cramer Bitcoin,`
3. **Website URL is malformed**: `https://tuna.fun/t/CRAMER,` (comma in URL!)
4. **SubTuna ticker is wrong**: `CRAMER,` instead of `CRAMER`
5. **SubTuna name is wrong**: `t/CRAMER,` instead of `t/CRAMER`
6. **No image**: Image generation failed (fixed in previous response)
7. **Twitter URL is correct**: `https://x.com/Maximo851565/status/2018408500469157969` ✓

## Root Cause

While I added cleanup in `assignParsedField()` (during parsing), the **actual code that USES these values** doesn't apply defensive cleaning. The CRAMER token was launched BEFORE the parsing fix was deployed, but more importantly, the code has these vulnerabilities:

### Line 636: Creating tickerUpper
```typescript
// Current (vulnerable)
const tickerUpper = parsed.symbol.toUpperCase();

// Should be (defensive)
const tickerUpper = parsed.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
```

### Lines 647-648: SubTuna insert uses dirty tickerUpper
```typescript
ticker: tickerUpper,  // Has comma!
name: `t/${tickerUpper}`,  // Has comma!
```

### Lines 674-675: API call uses raw parsed values
```typescript
name: parsed.name,  // Has trailing comma!
ticker: parsed.symbol,  // May have punctuation!
```

### Lines 752-753: Database insert uses raw parsed values
```typescript
name: parsed.name,  // Has trailing comma!
ticker: parsed.symbol,  // May have punctuation!
```

## Solution

Apply **defensive sanitization** at the point of use, not just at parse time. This ensures robustness even if parsing logic changes or data comes from other sources.

### Step 1: Create cleaned variables at the start of `processLaunchPost()`

Add these right after parsing, before any usage:

```typescript
// Defensive sanitization - ensure clean data regardless of parse source
const cleanName = parsed.name.replace(/[,.:;!?]+$/, "").slice(0, 32);
const cleanSymbol = parsed.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
```

### Step 2: Update all usage points

Replace all occurrences of:
- `parsed.name` → `cleanName`
- `parsed.symbol` → `cleanSymbol`
- `tickerUpper` → `cleanSymbol` (consolidate into one variable)

**Locations to update:**
| Line | Current | Fixed |
|------|---------|-------|
| 636 | `parsed.symbol.toUpperCase()` | `cleanSymbol` |
| 647 | `tickerUpper` | `cleanSymbol` |
| 648 | `t/${tickerUpper}` | `t/${cleanSymbol}` |
| 649 | `$${tickerUpper}` | `$${cleanSymbol}` |
| 657 | `t/${tickerUpper}` | `t/${cleanSymbol}` |
| 674 | `parsed.name` | `cleanName` |
| 675 | `parsed.symbol` | `cleanSymbol` |
| 678 | `${parsed.name}` | `${cleanName}` |
| 752 | `parsed.name` | `cleanName` |
| 753 | `parsed.symbol` | `cleanSymbol` |
| 807-808 | `$${tickerUpper}`, `parsed.name` | `$${cleanSymbol}`, `cleanName` |
| 850-852 | `tickerUpper` | `cleanSymbol` |

### Step 3: Fix the corrupted CRAMER token data

Run database updates to fix the existing token:

```sql
-- Fix fun_tokens
UPDATE fun_tokens 
SET 
  ticker = 'CRAMER',
  name = 'Inverse Cramer Bitcoin',
  website_url = 'https://tuna.fun/t/CRAMER'
WHERE ticker = 'CRAMER,' OR ticker = 'CRAMER';

-- Fix subtuna  
UPDATE subtuna 
SET 
  ticker = 'CRAMER',
  name = 't/CRAMER'
WHERE ticker = 'CRAMER,' OR ticker ILIKE '%CRAMER%';

-- Fix tokens table if exists
UPDATE tokens 
SET 
  ticker = 'CRAMER',
  name = 'Inverse Cramer Bitcoin'
WHERE ticker = 'CRAMER,' OR ticker = 'CRAMER';
```

## Files to Modify

1. **`supabase/functions/agent-process-post/index.ts`**
   - Add `cleanName` and `cleanSymbol` variables after parsing
   - Replace `tickerUpper` with `cleanSymbol`
   - Update all occurrences of `parsed.name` → `cleanName`
   - Update all occurrences of `parsed.symbol` → `cleanSymbol`

2. **Database** (manual update)
   - Fix the corrupted CRAMER token records

## Verification

After deployment, test with a new token launch containing:
```
!tunalaunch
name: Test Token,
symbol: $TEST,
wallet: [address]
```

Verify:
- SubTuna URL is `https://tuna.fun/t/TEST` (no $ or comma)
- Token name is `Test Token` (no trailing comma)
- Ticker is `TEST` (no $ or comma)
