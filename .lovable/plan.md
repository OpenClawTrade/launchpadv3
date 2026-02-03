
# Fix Performance Issues: Eliminate Duplicate Queries

## Problem Summary
The website is now loading data (confirmed via browser test), but performance is degraded due to:
- 3-4 duplicate `fun_tokens` queries firing on page load
- Each query taking 2-15 seconds under load
- Database indexes not being utilized efficiently due to query patterns

## Technical Changes

### 1. Pass tokens as props to child components (eliminate KingOfTheHill duplicate query)

**File: `src/pages/FunLauncherPage.tsx`**
- Pass `tokens` and `tokensLoading` as props to `KingOfTheHill` component
- Change from: `<KingOfTheHill />`
- Change to: `<KingOfTheHill tokens={tokens} isLoading={tokensLoading} />`

**File: `src/components/launchpad/KingOfTheHill.tsx`**
- Modify component to accept tokens as props instead of calling useFunTokens
- Update interface to accept: `{ tokens: FunToken[]; isLoading: boolean }`
- Remove the internal `useFunTokens()` call

### 2. Convert TokenTickerBar to use shared data

**File: `src/components/launchpad/TokenTickerBar.tsx`**
- Option A: Accept tokens as props from parent (cleanest)
- Option B: Use React Query with same queryKey to share cache

For consistency, implement Option A:
- Pass `tokens` from FunLauncherPage to TokenTickerBar
- Remove the independent supabase fetch

### 3. Optimize useFunTokens query with explicit query key

**File: `src/hooks/useFunTokens.ts`**
- The hook uses internal state instead of React Query
- This prevents cache sharing across components
- Consider refactoring to use React Query for better deduplication

## Expected Results
- Single `fun_tokens` query on page load instead of 3-4
- Faster initial page render (from ~15s to ~3s)
- Reduced database load
- Consistent data across all components

## Files to Modify
1. `src/pages/FunLauncherPage.tsx` - Pass tokens as props
2. `src/components/launchpad/KingOfTheHill.tsx` - Accept tokens prop, remove useFunTokens call
3. `src/components/launchpad/TokenTickerBar.tsx` - Accept tokens prop, remove internal fetch
4. Optional: `src/hooks/useFunTokens.ts` - Refactor to React Query for better caching

## Verification Steps
1. Open browser DevTools Network tab
2. Navigate to main page
3. Verify only ONE `fun_tokens` request is made
4. Confirm all sections (ticker, king of hill, token table) show data
5. Check page loads in under 5 seconds
