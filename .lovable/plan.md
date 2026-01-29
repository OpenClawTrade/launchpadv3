

# Add Debug Logger for Token Launch Flow

## Overview
Create a comprehensive frontend logging system that captures and displays all stages of the token launch process. This will allow you to see exactly what's happening, where delays occur, and what errors are returned - all in real-time within the UI.

## Current Situation
- The Helius RPC is exhausted (429 "max usage reached")
- The Edge Function times out waiting for Vercel API
- No frontend logs are visible because there's no logging UI
- Browser console logs disappear with page navigation

---

## Implementation Plan

### 1. Create Debug Logger Service
**File:** `src/lib/debugLogger.ts`

A singleton logger that:
- Captures timestamped log entries with levels (info, warn, error, debug)
- Stores logs in memory and localStorage (persists across refreshes)
- Provides methods to add entries and clear logs
- Calculates elapsed time from first log entry

```text
Example Log Output:
┌──────────────────────────────────────────────────────────────┐
│ 00:00.000 [INFO]  🚀 Launch started                          │
│ 00:00.012 [INFO]  Wallet validated: 7xKp...                  │
│ 00:00.015 [INFO]  Calling fun-create Edge Function...        │
│ 00:05.234 [WARN]  Still waiting for response...              │
│ 00:10.001 [ERROR] 504 Gateway Timeout                        │
│ 00:10.002 [ERROR] CORS: No Access-Control-Allow-Origin       │
└──────────────────────────────────────────────────────────────┘
```

### 2. Create Debug Panel UI Component
**File:** `src/components/debug/DebugLogPanel.tsx`

A collapsible panel that:
- Shows in the corner of the screen (toggleable)
- Displays all captured logs with color-coded levels
- Has a "Copy Logs" button to copy to clipboard
- Has a "Download" button to save as JSON file
- Has a "Clear" button to reset logs
- Auto-scrolls to newest entries
- Shows elapsed time for each entry

### 3. Add Logging to TokenLauncher
**File:** `src/components/launchpad/TokenLauncher.tsx`

Instrument the `performLaunch` function with detailed logging:
- Log when launch starts (with token details)
- Log before calling the Edge Function
- Log response status and timing
- Log any error messages
- Log success with mint address

### 4. Create Backend Log Upload Function
**File:** `supabase/functions/debug-logs/index.ts`

A simple Edge Function that:
- Accepts log entries via POST
- Stores them in a `debug_logs` table
- Includes client IP and timestamp
- Has a 10KB max payload to prevent abuse

### 5. Create Debug Logs Table
**Database migration:**
```sql
CREATE TABLE public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  client_ip TEXT,
  logs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-delete logs older than 7 days
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
```

### 6. Add Debug Toggle to FunLauncherPage
**File:** `src/pages/FunLauncherPage.tsx`

Add a small debug icon button that:
- Toggles the debug panel visibility
- Shows a badge when there are unread error logs
- Persists visibility preference in localStorage

---

## Technical Details

### DebugLogger API
```typescript
// Usage in components:
import { debugLog, getLogs, clearLogs } from '@/lib/debugLogger';

// Add a log entry
debugLog('info', 'Starting token launch', { tokenName, ticker });

// In error handlers
debugLog('error', 'Edge function failed', { status: 504, message: 'Gateway Timeout' });
```

### Panel Features
- Position: Bottom-right corner
- Default state: Collapsed (icon only)
- Expanded state: 400px wide, 50vh tall
- Dark theme matching app design
- Keyboard shortcut: Ctrl+Shift+D to toggle

### Log Entry Structure
```typescript
interface LogEntry {
  id: string;
  timestamp: number;
  elapsed: string; // "00:05.234"
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/debugLogger.ts` | Create | Core logging service |
| `src/components/debug/DebugLogPanel.tsx` | Create | UI panel component |
| `src/components/launchpad/TokenLauncher.tsx` | Modify | Add logging calls |
| `src/pages/FunLauncherPage.tsx` | Modify | Add debug panel |
| `supabase/functions/debug-logs/index.ts` | Create | Backend log storage |
| Database migration | Create | `debug_logs` table |

---

## Expected Outcome

After implementation, you will be able to:
1. See a small bug icon in the corner of the launcher page
2. Click it to open the debug panel
3. Attempt a token launch
4. Watch logs appear in real-time showing exactly where the process fails
5. Copy or download logs to share for debugging
6. Optionally upload logs to the backend for remote inspection

This will make it immediately clear if the issue is:
- Edge Function timeout (no response after X seconds)
- Helius RPC rate limit (error message will show "max usage")
- CORS configuration (specific header errors)
- Other network issues

