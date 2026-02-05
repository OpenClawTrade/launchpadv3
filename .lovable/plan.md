
# Fix Trading Agent Profile Page Navigation & Display

## Problem Summary

The Trading Agent profile page at `/agents/trading/edbc62a6-156d-44c0-87f8-ee306c0ea354` shows "Agent Not Found" despite the agent existing in the database. Additionally:
- The Funding tab shows "No agents currently in funding phase" even with pending agents
- EQBM trading agent has no SubTuna community
- Navigation from cards in the Trading Agents page goes to wrong destinations

## Root Causes Identified

1. **Edge Function Not Deployed**: The `trading-agent-list` edge function returns 404 - it needs to be deployed
2. **Missing SubTuna Community**: The EQBM trading agent has no `subtuna` record
3. **Data Query Issues**: The `useTradingAgent` hook may be hitting cache issues or RLS restrictions

## Solution

### Step 1: Deploy the Trading Agent List Edge Function

The `trading-agent-list` function exists in code but returns 404. Deploy it:

```text
supabase/functions/trading-agent-list/index.ts
```

This will enable the Funding and Active tabs to properly fetch and display trading agents.

### Step 2: Create SubTuna Community for EQBM

Insert the missing community record so users can access `/t/EQBM`:

```sql
INSERT INTO subtuna (name, ticker, description, icon_url, agent_id)
VALUES (
  'Equilibrium', 
  'EQBM', 
  'Official community for Equilibrium - Autonomous Trading Agent powered by AI',
  'https://ptwytypavumcrbofspno.supabase.co/storage/v1/object/public/trading-agents/eqbm-1770278381592.png',
  '9dd65f5d-caae-4ee1-bbd6-1794940c7e62'
);
```

### Step 3: Enhance the Trading Agent Profile Page

The existing `TradingAgentProfilePage.tsx` already has comprehensive features:
- Stats cards (Trading Capital, P&L, Win Rate, Total Trades, Avg Hold Time)
- Strategy info (Stop Loss, Take Profit, Max Positions)
- Tabs for Positions, Trade History, AI Insights
- Funding progress bar for pending agents
- Link to SubTuna community

**Additions needed:**

1. **Add "About" tab** with detailed strategy explanation
2. **Add link to trade the agent's token** (already exists but conditional on `mint_address`)
3. **Make SubTuna link always visible** using ticker

**File: `src/pages/TradingAgentProfilePage.tsx`**

```typescript
// Line ~116-120: Update SubTuna link to always show for trading agents
{agent.ticker && (
  <Link to={`/t/${agent.ticker}`} className="flex items-center gap-1 text-amber-400 hover:underline">
    <MessageSquare className="h-4 w-4" />
    <span>t/{agent.ticker}</span>
  </Link>
)}
```

Add new "Strategy" tab content:
```typescript
<TabsTrigger value="strategy" className="gap-1">
  <Shield className="h-4 w-4" />
  Strategy
</TabsTrigger>

<TabsContent value="strategy">
  <Card className="bg-card/50 border-border/50">
    <CardHeader>
      <CardTitle>Trading Strategy Details</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Strategy Type Explanation */}
      <div className="p-4 rounded-lg bg-secondary/30">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <StrategyIcon className={strategyInfo.color} />
          {strategyInfo.label} Strategy
        </h3>
        <p className="text-sm text-muted-foreground">
          {strategyDescriptions[agent.strategy_type]}
        </p>
      </div>
      
      {/* Risk Parameters */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-border/50">
          <h4 className="text-sm font-medium mb-3">Risk Parameters</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stop Loss</span>
              <span className="text-red-400">-{agent.stop_loss_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Take Profit</span>
              <span className="text-green-400">+{agent.take_profit_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Positions</span>
              <span>{agent.max_concurrent_positions}</span>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-lg border border-border/50">
          <h4 className="text-sm font-medium mb-3">Execution</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">DEX</span>
              <span>Jupiter V6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protection</span>
              <span>Jito Bundles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monitoring</span>
              <span>Every 15s</span>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

### Step 4: Fix the useTradingAgent Hook

Ensure the hook properly handles the data fetch:

**File: `src/hooks/useTradingAgents.ts`**

```typescript
// Line 141-159: Add better error handling and logging
export function useTradingAgent(id: string) {
  return useQuery({
    queryKey: ["trading-agent", id],
    queryFn: async () => {
      console.log("[useTradingAgent] Fetching agent:", id);
      
      const { data, error } = await supabase
        .from("trading_agents")
        .select(`
          *,
          agent:agents!agent_id(id, name, avatar_url, karma)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[useTradingAgent] Error:", error);
        throw error;
      }
      
      console.log("[useTradingAgent] Result:", data);
      return data as TradingAgent;
    },
    enabled: !!id && id.length === 36, // Only run for valid UUIDs
    staleTime: 30_000,
    retry: 2,
  });
}
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/trading-agent-list/index.ts` | Deploy (no code changes needed) |
| Database | Insert SubTuna community for EQBM |
| `src/pages/TradingAgentProfilePage.tsx` | Add Strategy tab, fix SubTuna link visibility |
| `src/hooks/useTradingAgents.ts` | Improve error handling, fix foreign key reference |

## Expected Outcome

After implementation:
1. Clicking a trading agent card navigates to `/agents/trading/:id` showing full profile
2. Profile page displays all agent info: stats, positions, trades, AI insights, strategy details
3. Link to SubTuna community always visible
4. Link to trade the agent's token visible when mint_address exists
5. Funding tab properly shows pending agents
6. Active tab shows active trading agents
