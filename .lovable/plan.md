
## What’s actually broken (based on your logs)

### 1) Your backend is timing out (not a React/UI bug)
- The browser requests for `/functions/v1/agent-stats` and `/rest/v1/subtuna_posts` are failing with **“Failed to fetch”**.
- The backend function logs for `agent-stats` show a real upstream failure:
  - **Cloudflare 522: Connection timed out**
  - Then: **“connection closed before message completed”**
That means the function started, tried to query the database, the database/API layer didn’t respond fast enough, and the request died.

### 2) `/agents` is the TunaBook feed and it runs a very expensive query
`/agents` renders `TunaBookPage`, which runs:
- `useSubTunaPosts({ limit: 50 })` with a **big multi-join select** (`subtuna_posts -> subtuna -> fun_tokens`, plus `profiles` author, plus `agents` author_agent).
This is exactly the kind of query that will time out under load.

### 3) `agent-tokens` backend function is currently missing in production
When I called it directly, it returned:
- **404 NOT_FOUND: Requested function was not found**
So anything depending on `/functions/v1/agent-tokens` will never load until that function is re-deployed/restored.

---

## Goals (fix “nothing loads” first)
1) **Stop infinite loading** (no more permanent skeletons/spinners).
2) Make `/agents` feed load reliably even if the database is slow.
3) Reduce overall database pressure so the whole site stops being “super slow”.

---

## Plan to fix it (fastest path first)

### Phase A — Make the UI fail-fast (no more infinite loaders)
**Why:** Right now, requests can hang until the network/server kills them, leaving React Query in `isLoading` for too long.

**Changes**
1) Add a shared helper like `fetchJsonWithTimeout()` (AbortController + timeout).
2) Update these queries to use timeout + controlled fallback:
   - `src/hooks/useSubTunaPosts.ts`
   - `src/hooks/useSubTuna.ts` (useRecentSubTunas)
   - `src/components/tunabook/TunaBookRightSidebar.tsx` (top agents)
   - `src/hooks/useAgentStats.ts`
3) UI behavior when backend is slow:
   - After (example) 8 seconds: show a clear “Backend is busy — Retry” state instead of skeletons forever.
   - Optional: show last cached result from `localStorage` so `/agents` displays instantly.

**Acceptance**
- `/agents` shows either:
  - real posts, OR
  - cached posts, OR
  - an error message with a Retry button
… but never a spinner forever.

---

### Phase B — Make `/agents` feed query cheap (remove the big joins)
**Why:** The current `subtuna_posts` query is doing multiple joins and is timing out.

**Changes**
1) Refactor `useSubTunaPosts` to **avoid nested relational selects** in one request.
   - Request 1: posts only (minimal columns)  
     `subtuna_posts: id,title,content,image_url,post_type,guest_upvotes,guest_downvotes,comment_count,is_pinned,is_agent_post,created_at,slug,subtuna_id,author_id,author_agent_id`
   - Request 2: subtunas by IDs (name,ticker,icon_url,fun_token_id)
   - Request 3: profiles by IDs (username,avatar_url) only if needed
   - Request 4: agents by IDs (name,avatar_url) only if needed
   - Merge client-side into the final shape used by `TunaPostCard`
2) Reduce initial load:
   - Change global feed default limit from **50 → 20/25**
3) Add a time window for global feed:
   - For `/agents` main feed, fetch only recent posts (example: last **7–14 days**) unless user scrolls / loads more.
   - This prevents huge scans.

**Acceptance**
- The `/rest/v1/subtuna_posts?...` request is smaller and returns faster.
- `/agents` renders posts consistently without timing out.

---

### Phase C — Stop realtime from hammering the backend
**Why:** `useSubTunaRealtime({ enabled: true })` on the global feed listens to:
- `subtuna_posts` (global)
- `subtuna_votes` (global)
and invalidates `["subtuna-posts"]` repeatedly. Under activity, that becomes a refetch storm.

**Changes**
1) In `src/hooks/useSubTunaRealtime.ts`:
   - For global feed: **unsubscribe from `subtuna_votes`** (or throttle it heavily).
   - Debounce invalidations (e.g. batch invalidations every 2–5 seconds instead of on every event).
2) Consider enabling realtime only on:
   - specific community pages `/t/:ticker`
   - single post threads
   …not the global feed.

**Acceptance**
- Opening `/agents` doesn’t cause constant refetch spam in the network panel.

---

### Phase D — Fix backend functions that are timing out (and restore the missing one)
#### D1) Restore `agent-tokens` function (it’s currently 404)
**Changes**
- Ensure `supabase/functions/agent-tokens/index.ts` is deployed (it exists in code but is missing in the backend).
- After deployment, confirm `/functions/v1/agent-tokens` returns 200.

#### D2) Make `agent-stats` return quickly even if DB is slow
**Why:** It currently performs heavier reads and can get stuck behind timeouts.

**Changes**
1) Add **hard timeouts** to its internal DB calls (AbortController).
2) Simplify stats computation to avoid joins:
   - Use `fun_tokens.agent_id IS NOT NULL` instead of querying `agent_tokens` join
   - Compute:
     - totalTokensLaunched = count(fun_tokens where agent_id not null)
     - totalMarketCap = sum(market_cap_sol) for those tokens
   - Keep the existing “return cached even if stale” behavior, but also add a **safe default** if cache is empty (so it always returns fast JSON).

**Acceptance**
- `agent-stats` responds within a few seconds even under load (with cached/default values if needed).

---

### Phase E — Add DB indexes to stop timeouts (structural fix)
**Why:** Sorting by `created_at`, `guest_upvotes`, `comment_count` on large tables will time out without indexes.

**Migration (backend SQL)**
Add indexes like:
- `subtuna_posts(created_at desc)`
- `subtuna_posts(guest_upvotes desc, created_at desc)`
- `subtuna_posts(comment_count desc, created_at desc)`
- `subtuna_posts(subtuna_id, created_at desc)`
- `agents(status, total_fees_earned_sol desc)` (for top agents sidebar)
- `subtuna(created_at desc)`
- `agent_tokens(created_at desc)` (if still used)

**Acceptance**
- The same requests that previously caused 522 become consistently fast.

---

## Testing checklist (what I’ll verify after implementing)
1) Open `/agents`:
   - feed shows posts OR cached posts OR “Retry” message (no infinite skeletons)
2) Network panel:
   - no repeated refetch storms from realtime
3) Direct backend checks:
   - `/functions/v1/agent-tokens` returns 200 (no 404)
   - `/functions/v1/agent-stats` returns 200 quickly (even if values are cached/default)
4) Main page:
   - token list and key panels no longer take “forever” due to timeouts.

---

## Files I expect to touch
Frontend:
- `src/hooks/useSubTunaPosts.ts`
- `src/hooks/useSubTuna.ts` (useRecentSubTunas)
- `src/hooks/useSubTunaRealtime.ts`
- `src/components/tunabook/TunaBookRightSidebar.tsx`
- `src/hooks/useAgentStats.ts`
- (new) `src/lib/fetchWithTimeout.ts` (or similar helper)

Backend functions:
- `supabase/functions/agent-stats/index.ts`
- `supabase/functions/agent-tokens/index.ts`

Database (migration):
- Add indexes listed in Phase E

---

## Why this will fix “nothing loads”
Right now, the site is waiting on slow database calls until they die (522), and the UI keeps showing loading states. The plan makes requests:
- smaller,
- index-supported,
- and time-bounded,
so the UI always exits loading and the backend stops getting hammered.
