
# Fix Ticker Corruption - Complete Solution

## Problem Summary
The ticker corruption issue ("THNKHTTPST" instead of "THNK") is **still occurring** despite the previous fix. The investigation reveals the problem happens **before** the `assignParsedField` function is called.

## Root Cause Analysis

### Evidence from Database

| Tweet | Raw Content | Parsed Symbol | Result |
|-------|-------------|---------------|--------|
| 10:51 | `symbol: THNK description: ...` | THNK ✅ | Correct |
| 10:55 | `symbol: THNK https://t.co/...` | THNKHTTPST ❌ | Corrupted |

The difference: In the second tweet, the URL was on the **same line** as the symbol field.

### The Bug Location

**File**: `supabase/functions/agent-process-post/index.ts`

**Line 478** in `parseSingleLine` function:
```typescript
// Current (BUGGY):
value = value.replace(/https?:\/\/\S+$/i, "").trim();
```

This regex only removes URLs at the **very end** of the string (the `$` anchor). When the tweet has:
```
symbol: THNK https://t.co/abc123
```

The extracted value is `THNK https://t.co/abc123`. The regex fails to match because the URL is followed by nothing but IS at the end - however when there's whitespace or other characters after, or when the regex engine processes it, fragments survive.

Then `assignParsedField` receives `THNK https://t.co/abc123`, and even with the fix, when the alphanumeric filter runs: `THNKhttpstcoabc123` → sliced to 10 chars → `THNKHTTPST`.

## Solution

### Fix 1: Update `parseSingleLine` URL Stripping (Line 478)

**Before:**
```typescript
value = value.replace(/https?:\/\/\S+$/i, "").trim();
```

**After:**
```typescript
value = value.replace(/https?:\/\/\S+/gi, "").trim();
```

Remove the `$` anchor so ALL URLs are stripped, not just trailing ones.

### Fix 2: Add URL Stripping to Defensive Sanitization (Line 880)

**Before:**
```typescript
const cleanSymbol = parsed.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
```

**After:**
```typescript
const cleanSymbol = parsed.symbol
  .replace(/https?:\/\/\S+/gi, "")  // Strip any surviving URLs
  .replace(/[^a-zA-Z0-9]/g, "")
  .toUpperCase()
  .slice(0, 10);
```

This is a safety net in case any URL fragments survive earlier parsing.

### Fix 3: Same for Name (Line 879)

**Before:**
```typescript
const cleanName = parsed.name.replace(/[,.:;!?]+$/, "").slice(0, 32);
```

**After:**
```typescript
const cleanName = parsed.name
  .replace(/https?:\/\/\S+/gi, "")  // Strip any surviving URLs
  .replace(/[,.:;!?]+$/, "")
  .trim()
  .slice(0, 32);
```

## Database Cleanup Required

After deployment, run these SQL commands to fix corrupted data:

```sql
-- Fix SubTuna communities with corrupted tickers
UPDATE subtuna 
SET 
  ticker = REGEXP_REPLACE(ticker, 'HTTP.*$', '', 'i'),
  name = 't/' || REGEXP_REPLACE(ticker, 'HTTP.*$', '', 'i')
WHERE ticker LIKE '%HTTP%';

-- Fix fun_tokens website URLs pointing to corrupted SubTuna paths
UPDATE fun_tokens 
SET website_url = REGEXP_REPLACE(website_url, 'HTTP[^/]*$', '', 'i')
WHERE website_url LIKE '%/t/%HTTP%';
```

## Technical Summary

| Location | Current Bug | Fix |
|----------|-------------|-----|
| Line 478 (parseSingleLine) | URL regex has `$` anchor - only matches trailing URLs | Remove `$` anchor |
| Line 879-880 (defensive sanitization) | No URL stripping before alphanumeric filter | Add URL stripping first |

## Impact
- Prevents future ticker corruption from tweets with inline URLs
- Fixes SubTuna community names being created with corrupted tickers
- Fixes website_url pointing to non-existent SubTuna paths

## Files to Modify
1. `supabase/functions/agent-process-post/index.ts`
   - Line 478: Fix URL regex
   - Lines 879-880: Add URL stripping to defensive sanitization

## Deployment
After code changes, the edge function will be auto-deployed. Then run the SQL cleanup queries.
