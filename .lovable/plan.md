

# Fix Trading Agent Data Accuracy

## Problems Found

After inspecting the 67 Agent's actual database records, here are the issues:

1. **Token images are broken**: The `token_image_url` field stores raw pump.fun IPFS hashes (e.g., `71e1a9aa...`) instead of full URLs. The UI tries to use them as `src` directly, so no images display.

2. **Token symbol shows "???"**: All pump.fun tokens have `symbol: ???` by default. The UI displays `$???` which is unhelpful. Should fall back to `token_name`.

3. **Stats not updating on position close**: The agent has `total_trades: 4`, `winning_trades: 0`, `losing_trades: 0` even though one position was closed. The monitor doesn't update win/loss counters when closing positions.

4. **Unrealized P&L stuck at 0**: All open positions show `unrealized_pnl_sol: 0` and `unrealized_pnl_pct: 0` -- the monitor isn't updating current prices from Jupiter quotes.

---

## Changes

### 1. Fix token image URLs in the UI (TradingAgentProfilePage.tsx)

Add a helper function that detects raw IPFS hashes and prepends the correct CDN URL:

```typescript
function resolveTokenImage(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  // Raw pump.fun IPFS hash
  return `https://ipfs.io/ipfs/${url}`;
}
```

Apply this to all `<AvatarImage src={...}>` instances for positions.

### 2. Fix token symbol fallback (TradingAgentProfilePage.tsx)

Replace `${position.token_symbol}` displays with:
```typescript
{position.token_symbol && position.token_symbol !== '???' 
  ? position.token_symbol 
  : position.token_name || 'Unknown'}
```

Apply the same logic in the trade history section for `trade.token_name`.

### 3. Fix image URL at source (trading-agent-execute edge function)

When storing `token_image_url` in the position record, prefix the IPFS hash:

```typescript
token_image_url: selectedToken.image_url?.startsWith('http') 
  ? selectedToken.image_url 
  : `https://ipfs.io/ipfs/${selectedToken.image_url}`,
```

This ensures future positions have correct URLs from the start.

### 4. Fix stats update on position close (trading-agent-monitor edge function)

In the `processPositionClosure` function (or wherever positions are marked as closed), add logic to update the agent's aggregate stats:

```sql
UPDATE trading_agents SET
  winning_trades = winning_trades + (CASE WHEN pnl > 0 THEN 1 ELSE 0 END),
  losing_trades = losing_trades + (CASE WHEN pnl <= 0 THEN 1 ELSE 0 END),
  total_profit_sol = total_profit_sol + pnl,
  win_rate = (winning_trades + new_win) / total_trades * 100,
  best_trade_sol = GREATEST(best_trade_sol, pnl),
  worst_trade_sol = LEAST(worst_trade_sol, pnl)
WHERE id = agent_id
```

### 5. Fix existing bad data (database update)

Update the 3 existing positions to have correct image URLs:

```sql
UPDATE trading_agent_positions 
SET token_image_url = 'https://ipfs.io/ipfs/' || token_image_url
WHERE trading_agent_id = '1776eabc-5e58-46e2-be1d-5300dd202b51'
  AND token_image_url NOT LIKE 'http%';
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/TradingAgentProfilePage.tsx` | Add `resolveTokenImage()` helper, fix token symbol fallback display |
| `supabase/functions/trading-agent-execute/index.ts` | Prefix IPFS hash with CDN URL when storing image |
| `supabase/functions/trading-agent-monitor/index.ts` | Update agent stats (win/loss/pnl) when closing positions |
| Database (data fix) | Update existing position image URLs to full IPFS URLs |

