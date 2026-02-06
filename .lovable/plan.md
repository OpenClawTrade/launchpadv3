
# Fix: Trading Agents Not Showing in Funding Tab

## Problem Summary

The "Funding" tab on `/agents/trading` shows "No agents currently in funding phase" even though there are 2 pending trading agents in the database.

## Root Cause

The `trading-agent-list` edge function **is not deployed**. When the frontend calls:
```
GET /functions/v1/trading-agent-list?status=pending
```
It receives a **404 NOT_FOUND** error, causing the React Query to fail silently and show no agents.

## Evidence

1. **Database has agents**: Query found 2 pending trading agents:
   - Equilibrium (EQM) - 0.0024 SOL
   - Equilibrium (EQBM) - 0.08 SOL

2. **Edge function returns 404**: 
```
curl /trading-agent-list?status=pending
→ 404: "Requested function was not found"
```

3. **No deployment logs**: The function has no execution logs, confirming it was never deployed.

## Solution

Deploy the `trading-agent-list` edge function. The code exists at `supabase/functions/trading-agent-list/index.ts` and is correctly implemented.

## Technical Details

| Item | Details |
|------|---------|
| Function Path | `supabase/functions/trading-agent-list/index.ts` |
| Issue | Not deployed to Lovable Cloud |
| Fix | Deploy the edge function |
| Expected Result | Both pending agents appear in Funding tab |

## Implementation

**Step 1**: Deploy the `trading-agent-list` edge function

No code changes are required - the function code is already correct with proper CORS headers. It just needs to be deployed.

## Verification

After deployment:
1. The Funding tab will show 2 agents with their funding progress bars
2. The Active tab will work correctly for active agents
3. The Top Performers tab will show leaderboard data
