
## Goal
Fix the “Recent Communities” sidebar so it shows `t/TUNA` (and other communities) instead of `t/` (blank ticker), and ensure the links generated from that section navigate correctly everywhere it’s used.

## What’s happening (root cause)
- The sidebar renders `t/{subtuna.ticker}` (seen in `src/components/tunabook/TunaBookSidebar.tsx`).
- The data for that sidebar comes from `useRecentSubTunas()` in `src/hooks/useSubTuna.ts`.
- `useRecentSubTunas()` maps `ticker: s.ticker || s.fun_tokens?.ticker || ""`, but the database query **does not SELECT `ticker` from `subtuna`**, so `s.ticker` is always undefined.
- For system communities like `t/TUNA`, `fun_token_id` is null (so `s.fun_tokens?.ticker` is also null), producing an empty string → UI shows `t/`.

We also confirmed in the database that the system SubTuna row does have `ticker = 'TUNA'`, so this is purely a frontend query/selection bug.

## Scope (where this will fix it)
`useRecentSubTunas()` is used in multiple pages (so one fix covers all):
- `src/pages/TunaBookPage.tsx`
- `src/pages/TunaPostPage.tsx`
- `src/pages/SubTunaPage.tsx`
- `src/pages/AgentProfilePage.tsx`

## Implementation steps (code changes)
### 1) Fix the data fetch in `useRecentSubTunas`
**File:** `src/hooks/useSubTuna.ts`

Change the `.select()` to include the `ticker` column from the `subtuna` table:

- Add `ticker,` alongside the other selected fields:
  - `id, name, description, icon_url, member_count, post_count, ticker, ...`

This ensures `s.ticker` is actually present for system SubTunas like `t/TUNA`.

### 2) Add a safe fallback for older/edge records (optional but recommended)
Still in `useRecentSubTunas` mapping, if both `s.ticker` and `s.fun_tokens?.ticker` are missing:
- Derive from the name if it matches `t/SOMETHING`:
  - If `s.name` starts with `t/`, use the part after `t/`
- Otherwise keep it empty

This prevents `t/` from showing up if there are any incomplete rows.

### 3) Force-refresh cached results (optional but helps immediately)
React Query may be showing a cached result in an already-open session.
To guarantee users see the fix immediately without waiting:
- Change the queryKey from `["recent-subtunas", limit]` to something versioned like `["recent-subtunas-v2", limit]`

This safely busts the old cache.

## Verification checklist
1. Open TunaBook (or any page with the left sidebar).
2. In “Recent Communities”, confirm it shows `t/TUNA` (not `t/`).
3. Click `t/TUNA` and confirm it navigates to `/t/TUNA` (and not `/t/`).
4. Click a post from that community and confirm the post URL keeps the ticker (no `/t//post/...`).

## Notes / Non-goals
- This plan addresses the “Recent Communities shows t/” issue and the link correctness stemming from missing ticker.
- Your separate request about SEO-friendly post URLs (slugs) is a bigger routing + DB change; we can implement it next once the ticker problem is fully resolved.
