
# Fix: Display Trading Agents with "Pending" Status

## Problem Identified
The trading agent "Equilibrium" (EQBM) is not appearing on the Trading Agents page because:
- Its status is `pending` (awaiting 0.5 SOL funding threshold)
- The page only fetches and displays agents with `status: 'active'`
- There's no tab or section for pending/funding agents

## Solution Overview
Add a "Funding" tab to the Trading Agents page that displays agents awaiting activation, allowing users to see and fund newly created trading agents.

---

## Implementation Steps

### 1. Update TradingAgentsPage.tsx
Add a new "Funding" tab alongside "Active" and "Top Performers":
- Add a new query hook for pending agents
- Create a third tab showing agents with `status: 'pending'`
- Display the funding progress bar for each pending agent
- Show a message explaining these agents need funding to activate

### 2. Update useTradingAgents Hook (Optional Enhancement)
Consider removing the hardcoded `status: "active"` filter so the page can dynamically switch between statuses based on tab selection.

---

## Technical Details

**File: `src/pages/TradingAgentsPage.tsx`**

Changes needed:
```
1. Add second query for pending agents:
   const { data: pendingAgents } = useTradingAgents({
     status: "pending",
     limit: 12,
   });

2. Add "Funding" tab trigger:
   <TabsTrigger value="funding">
     Funding ({pendingAgents?.length || 0})
   </TabsTrigger>

3. Add TabsContent for funding:
   <TabsContent value="funding">
     {pendingAgents?.map(agent => (
       <TradingAgentCard agent={agent} />
     ))}
   </TabsContent>
```

**Component Behavior:**
- The `TradingAgentCard` already handles pending status and displays the `TradingAgentFundingBar`
- No changes needed to the card component

---

## Alternative Quick Fix
If you prefer, we can simply update the agent's status to `active` in the database immediately. This is a one-time fix but doesn't solve the broader UX issue of showing pending agents.

```sql
UPDATE trading_agents 
SET status = 'active' 
WHERE id = 'edbc62a6-156d-44c0-87f8-ee306c0ea354';
```

---

## Recommendation
Implement the "Funding" tab solution - it properly supports the trading agent lifecycle where new agents start as pending and need community funding before activation.
