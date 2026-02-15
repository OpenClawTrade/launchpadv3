

# Background Whale Scanner - Server-Side Persistent Scanning

## Problem

Currently the whale scanner runs entirely in the browser -- when you close the tab, scanning stops and you miss blocks. You want it to run persistently on the server so no transaction is ever missed.

## Solution

Use a **database-driven job system** with a **self-calling edge function** pattern. When you click "Start Scanner", it creates a scan session in the database and triggers the edge function. The edge function processes slots, saves results to the database, then **calls itself again** to continue -- completely independent of the browser. If it crashes, the frontend detects the stall and re-triggers it.

```text
Click "Start Scanner"
      |
      v
  Insert scan_session row in DB (status: "running", last_slot, config)
      |
      v
  Call sol-whale-scanner edge function once
      |
      v
  Edge function:
    1. Read session from DB
    2. Scan slots (5-10 per call)
    3. Save found addresses to DB (whale_addresses table)
    4. Update session.last_slot in DB
    5. If session still "running" and not expired --> call ITSELF again via fetch()
    6. If error --> update session.error_count, call itself again (auto-retry)
      |
      v
  Runs indefinitely in background until:
    - 30 min elapsed (auto-stop)
    - User clicks "Stop" (sets session status to "stopped")
    - 10 consecutive errors (sets status to "failed", UI auto-restarts)
```

The frontend becomes a **viewer only** -- it polls the DB every 3 seconds to show live stats and addresses. Even if you close the browser entirely, scanning continues.

## Database Tables

### `whale_scan_sessions`
Tracks active/past scan sessions:
- `id` (uuid, PK)
- `status` (text: "running" | "stopped" | "completed" | "failed")
- `min_sol` (numeric, default 10)
- `slots_per_call` (integer, default 5)
- `last_slot` (bigint) -- resume point
- `started_at` (timestamptz)
- `expires_at` (timestamptz) -- 30 min from start
- `total_slots_scanned` (integer, default 0)
- `total_swaps` (integer, default 0)
- `total_transfers` (integer, default 0)
- `total_volume` (numeric, default 0)
- `credits_used` (integer, default 0)
- `error_count` (integer, default 0)
- `last_error` (text)
- `last_poll_at` (timestamptz) -- heartbeat to detect stalls

### `whale_addresses`
All captured addresses (persistent, never lost):
- `id` (uuid, PK)
- `session_id` (uuid, FK to whale_scan_sessions)
- `address` (text)
- `times_seen` (integer, default 1)
- `total_volume_sol` (numeric, default 0)
- `activity_types` (text[], e.g. {"SWAP","TRANSFER"})
- `sources` (text[], e.g. {"JUPITER","RAYDIUM"})
- `last_seen_at` (timestamptz)
- `created_at` (timestamptz)

Unique constraint on `(session_id, address)` so we upsert on each scan.

Both tables have RLS disabled (admin-only usage, no public access needed).

## Edge Function Changes: `sol-whale-scanner/index.ts`

The function gets two modes:

**Mode 1: "start"** -- Called by frontend to kick off a session
- Reads `session_id` from request body
- Fetches session config from DB
- Begins scanning slots
- Upserts found addresses into `whale_addresses`
- Updates session stats (last_slot, total_slots_scanned, etc.)
- Updates `last_poll_at` as heartbeat
- At the end, if session still "running" and not expired, **calls itself** via `fetch()` to continue
- If error occurs, increments `error_count`; if < 10 consecutive errors, retries

**Mode 2: "stop"** -- Called by frontend
- Sets session status to "stopped"

**Mode 3: "status"** -- Called by frontend to poll results
- Returns session stats + latest addresses from DB

**Self-continuation pattern:**
```text
// At end of processing:
if (session.status === "running" && Date.now() < session.expires_at) {
  // Fire-and-forget call to self
  fetch(SELF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer ANON_KEY" },
    body: JSON.stringify({ action: "continue", sessionId })
  });
}
```

**Auto-recovery:**
- Each call updates `last_poll_at` timestamp
- If the function crashes without self-calling, the frontend detects `last_poll_at` is stale (> 30 seconds old) and re-triggers the function
- The function picks up from `last_slot` in the DB -- no blocks missed

## Frontend Changes: `WhaleScanner.tsx`

Simplified to be a **dashboard/viewer**:

**Start Scanner button:**
1. POST to edge function with `action: "start"`, `minSol`, `slotsPerCall`
2. Edge function creates session in DB, returns `sessionId`
3. Frontend stores `sessionId` in localStorage
4. Starts a 3-second polling interval calling the edge function with `action: "status"` to get latest stats and addresses from DB

**Stop Scanner button:**
1. POST to edge function with `action: "stop"`, `sessionId`
2. Stops polling

**Auto-recovery (stall detection):**
- On each status poll, check `last_poll_at`
- If `last_poll_at` is more than 30 seconds old and session status is still "running", call `action: "continue"` to restart the background loop
- Log "Scanner stalled, auto-restarting..." in the console

**Display:**
- Same stats cards, address table, copy/export as before
- New indicator: green dot "Running on server" when background function is active
- All data comes from DB now, not localStorage (though localStorage cache for offline viewing is kept)

**Resume on page load:**
- On mount, check localStorage for active `sessionId`
- If found, poll DB for session status
- If still "running", resume the polling UI
- If "failed", offer "Restart" button which creates new session starting from `last_slot`

## Key Guarantees

1. **No missed blocks**: `last_slot` is persisted in DB before self-call; next iteration starts from `last_slot + 1`
2. **Auto-restart on crash**: Frontend detects stale `last_poll_at` and re-triggers; edge function resumes from DB state
3. **Browser-independent**: Once started, the edge function chain runs entirely server-side
4. **All addresses saved**: Every address goes to `whale_addresses` table via upsert -- even if frontend is closed
5. **30-min auto-expiry**: `expires_at` prevents runaway scanning; function checks this on every iteration

## Cost / Limits

- Edge function max duration is ~60 seconds per invocation
- Each invocation scans 5-10 slots, then self-calls for next batch
- Estimated ~900 self-calls over 30 minutes (one every 2 seconds)
- Same Helius credit usage as before (~1,200-5,000 credits per 30 min)

