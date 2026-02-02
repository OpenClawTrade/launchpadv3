

# Fix: Agent Payouts Stat Shows Earned Amount Instead of Claimed

## Problem

The "Agent Payouts" stat on the launchpad shows **0.00 SOL** because it currently displays `total_fees_claimed_sol` (actual payouts made), but no agents have claimed yet.

**Current data:**
- Total Agent Earnings: **14.66 SOL** (80% share of trading fees)
- Total Agent Claimed: **0 SOL** (no payouts processed yet)

The user wants to see the **earned** amount (what agents are entitled to), not just what's been paid out.

## Solution

Change the "Agent Payouts" stat to show `total_fees_earned_sol` instead of `total_fees_claimed_sol`.

## Technical Changes

### File: `supabase/functions/agent-stats/index.ts`

**Lines 95-99** - Update to use `total_fees_earned_sol`:

```typescript
// Current (incorrect)
const totalAgentPayouts = agents?.reduce(
  (sum, a) => sum + Number(a.total_fees_claimed_sol || 0),
  0
) || 0;

// New (correct)
const totalAgentPayouts = agents?.reduce(
  (sum, a) => sum + Number(a.total_fees_earned_sol || 0),
  0
) || 0;
```

This is a one-line change in the edge function.

## Alternative: Show Both Stats

If you want to distinguish between earned and claimed, I can instead:
1. Rename "Agent Payouts" → "Agent Earnings" (shows earned)
2. Add a new "Agent Claimed" stat (shows actual payouts)

Let me know if you prefer this approach.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/agent-stats/index.ts` | Change line 97 from `total_fees_claimed_sol` to `total_fees_earned_sol` |

## Expected Result

After fix: "Agent Payouts" will show **14.66 SOL** instead of 0.00 SOL

