

## Goal
Implement **server-side pagination** so only the tokens needed for the current page are fetched, dramatically reducing load times and data transfer.

## Root Cause Confirmed

| Component | Current Behavior | Wasteful |
|-----------|-----------------|----------|
| `useFunTokens()` | Fetches 100 tokens every time | Yes - loads 5x more than needed |
| `TokenTable` | Client-side `.slice()` on 100 tokens | Yes - all data already loaded |
| `KingOfTheHill` | Receives 100 tokens, shows 3 | Yes - 97 tokens wasted |

## Implementation Plan

### Phase 1: Create Server-Side Paginated Hook

**New file: `src/hooks/useFunTokensPaginated.ts`**

```text
┌─────────────────────────────────────────────────────────┐
│  useFunTokensPaginated(page, pageSize)                  │
│                                                          │
│  → Fetches ONLY tokens for current page                 │
│  → Uses .range(from, to) for true DB pagination         │
│  → Returns: { tokens, totalCount, isLoading }           │
│  → Caches each page independently in React Query        │
└─────────────────────────────────────────────────────────┘
```

Key changes:
- Add `page` and `pageSize` parameters
- Use Supabase `.range((page-1)*pageSize, page*pageSize - 1)` 
- Separate query for total count (or use Supabase count option)
- Each page cached with key `["fun-tokens", page, pageSize]`

### Phase 2: Create King of the Hill Hook

**New file: `src/hooks/useKingOfTheHill.ts`**

```text
┌─────────────────────────────────────────────────────────┐
│  useKingOfTheHill()                                      │
│                                                          │
│  → Fetches ONLY top 3 tokens by bonding_progress        │
│  → Filter: status = 'active'                            │
│  → Order: bonding_progress DESC                         │
│  → Limit: 3                                             │
│  → Cached separately from main token list               │
└─────────────────────────────────────────────────────────┘
```

This is a separate optimized query - only 3 rows fetched.

### Phase 3: Update TokenTable Component

**File: `src/components/launchpad/TokenTable.tsx`**

Changes:
- Accept `page`, `totalCount`, `onPageChange` as props (or manage internally with the new hook)
- Remove client-side slicing
- Pagination controls trigger new fetch instead of array slice

### Phase 4: Update FunLauncherPage

**File: `src/pages/FunLauncherPage.tsx`**

Changes:
- Replace `useFunTokens()` with `useFunTokensPaginated(page, 15)`
- Add page state management
- Use separate `useKingOfTheHill()` for that component
- `JustLaunched` can use `useFunTokensPaginated(1, 5)` or similar

### Phase 5: Optimize Related Components

| Component | Current | After |
|-----------|---------|-------|
| `TokenTickerBar` | Receives 100 tokens | Use `useFunTokensPaginated(1, 10)` |
| `JustLaunched` | Receives 100 tokens | Use dedicated query for 5 newest |
| `KingOfTheHill` | Receives 100 tokens | Use `useKingOfTheHill()` (3 tokens) |

---

## Technical Details

### New Paginated Query Structure

```typescript
// useFunTokensPaginated.ts
async function fetchPage(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, count, error } = await supabase
    .from("fun_tokens")
    .select("id, name, ticker, ...", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
    
  return { tokens: data, totalCount: count };
}
```

### King of the Hill Query

```typescript
// useKingOfTheHill.ts
const { data } = await supabase
  .from("fun_tokens")
  .select("id, name, ticker, bonding_progress, ...")
  .eq("status", "active")
  .order("bonding_progress", { ascending: false })
  .limit(3);
```

### Caching Strategy

Each page is cached independently:
- Page 1 cached as `["fun-tokens-page", 1]`
- Page 2 cached as `["fun-tokens-page", 2]`
- King of Hill cached as `["king-of-hill"]`
- When user navigates, only missing pages are fetched

### Real-time Updates

Real-time subscriptions will invalidate relevant cache entries:
- New token → invalidate page 1 + King of Hill
- Token update → invalidate affected page + King of Hill if in top 3

---

## Expected Performance Improvement

| Metric | Before | After |
|--------|--------|-------|
| Initial DB rows fetched | 100 | 15-18 (page + KOTH) |
| Data transfer | ~50KB | ~8KB |
| Parse/render time | High (100 items) | Low (15 items) |
| Page 2 navigation | Instant (client) | Fast (~100ms DB) |

The trade-off: Page navigation requires a small fetch, but initial load is **5-6x faster**.

---

## Files to Create/Modify

**Create:**
- `src/hooks/useFunTokensPaginated.ts`
- `src/hooks/useKingOfTheHill.ts`

**Modify:**
- `src/components/launchpad/TokenTable.tsx` - Accept server-side pagination props
- `src/pages/FunLauncherPage.tsx` - Use new hooks
- `src/components/launchpad/KingOfTheHill.tsx` - Use dedicated hook
- `src/components/launchpad/JustLaunched.tsx` - Use limited query
- `src/components/launchpad/TokenTickerBar.tsx` - Use limited query

**Keep (Legacy):**
- `src/hooks/useFunTokens.ts` - May be used elsewhere, deprecate gradually

