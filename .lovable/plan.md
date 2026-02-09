

# Limit Trading Agent to 2 Max Open Positions

## Problem
Agent 67 is on "balanced" strategy, which currently allows **3 concurrent positions**. The aggressive strategy allows **5**. You want a hard cap of **2 open positions** across all strategies.

## Changes

### 1. Update `STRATEGIES` config in `trading-agent-execute` edge function
Change `maxPositions` for all strategies:

```
conservative: maxPositions 2 -> 2 (no change)
balanced:     maxPositions 3 -> 2
aggressive:   maxPositions 5 -> 2
```

File: `supabase/functions/trading-agent-execute/index.ts` (lines 12-16)

### 2. Update DB column for Agent 67
Set `max_concurrent_positions = 2` in the `trading_agents` table for this agent (and any others currently set higher) so the UI also reflects the correct limit.

### 3. Update `trading-agent-create` defaults
In `supabase/functions/trading-agent-create/index.ts`, change the `max_concurrent_positions` assignment so new agents of any strategy get **2** max positions.

### 4. Redeploy
Redeploy `trading-agent-execute` and `trading-agent-create` edge functions.

