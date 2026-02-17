

## Fix Vanity Generator: TUNA Suffix + True Background Scanning

### Issue 1: Wrong suffix "TNA" hardcoded in 4 backend files

The frontend was updated to "TUNA" but **all backend files still use "TNA"**:

| File | Line | Current | Fix |
|------|------|---------|-----|
| `supabase/functions/vanity-cron/index.ts` | 12 | `TARGET_SUFFIX = 'TNA'` | `TARGET_SUFFIX = 'TUNA'` |
| `api/vanity/batch.ts` | 18 | `DEFAULT_SUFFIX = 'TNA'` | `DEFAULT_SUFFIX = 'TUNA'` |
| `api/vanity/generate.ts` | 22 | `DEFAULT_SUFFIX = 'TNA'` | `DEFAULT_SUFFIX = 'TUNA'` |
| `lib/vanityGenerator.ts` | 35-36 | Case-insensitive match (`toLowerCase`) | Case-SENSITIVE match (`endsWith` exact) |

### Issue 2: Case-sensitive matching is broken

`lib/vanityGenerator.ts` line 35-36 uses `toLowerCase()` for matching, meaning it accepts any case variation (e.g. "tuna", "Tuna", "tUNA") instead of strictly uppercase "TUNA". Must change to exact/case-sensitive matching.

### Issue 3: "Kicked out" during background scanning

The "Auto-Run" feature relies on the browser sequentially calling `api/vanity/batch` (55s each). If the browser tab sleeps, the network drops, or the Vercel function times out, the loop dies.

**Fix:** Make the `vanity-cron` edge function the true background worker. It already runs server-side but is hardcoded to "TNA" with a tiny 3-second duration. Update it to:
- Use "TUNA" suffix
- Increase `MAX_DURATION_MS` to 25000 (25s, safe for edge function limits)
- Increase `BATCH_SIZE` to 100
- Add a manual trigger button on the admin page that calls the edge function directly (fire-and-forget, no waiting)
- The admin page can poll status independently without blocking

### Changes

#### 1. `lib/vanityGenerator.ts` - Fix case-sensitive matching

Change `matchesSuffix` to do exact case-sensitive comparison:
```typescript
function matchesSuffix(address: string, suffix: string): boolean {
  return address.endsWith(suffix); // Case-sensitive: TUNA only
}
```

#### 2. `api/vanity/batch.ts` - Update default suffix

```typescript
const DEFAULT_SUFFIX = 'TUNA';
```

#### 3. `api/vanity/generate.ts` - Update default suffix

```typescript
const DEFAULT_SUFFIX = 'TUNA';
```

#### 4. `supabase/functions/vanity-cron/index.ts` - Fix suffix + boost performance

- Change `TARGET_SUFFIX` from `'TNA'` to `'TUNA'`
- Increase `MAX_DURATION_MS` from 3000 to 25000
- Increase `BATCH_SIZE` from 20 to 100
- Store suffix as `'tuna'` (lowercase) in DB for consistency with existing queries

#### 5. `src/pages/VanityAdminPage.tsx` - Add "Run Background" button

Add a button that calls the `vanity-cron` edge function directly (fire-and-forget). This way the generation runs fully server-side and the user can close the page without killing the process. The page can poll `/api/vanity/status` to see new results appear.

### Summary

| What | Before | After |
|------|--------|-------|
| Suffix | "TNA" in all backends | "TUNA" everywhere |
| Case matching | Case-insensitive (any case) | Case-sensitive (exact TUNA) |
| Background scanning | Browser-dependent loop | Server-side edge function, fire-and-forget |
| Edge function duration | 3 seconds | 25 seconds |

### Files to modify
- `lib/vanityGenerator.ts`
- `api/vanity/batch.ts`
- `api/vanity/generate.ts`
- `supabase/functions/vanity-cron/index.ts`
- `src/pages/VanityAdminPage.tsx`

