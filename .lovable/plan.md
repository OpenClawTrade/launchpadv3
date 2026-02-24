

## Fix External Token Trading: Trades Display + Swap Routing

### Problem Summary
Two issues with external tokens (e.g., Pump.fun tokens not in our database):

1. **"No trades yet"** -- The Codex `getTokenEvents` API returns data, but it may be empty for very new tokens or the edge function may need the correct pair address rather than just the token address.

2. **"No route found"** -- The `UniversalTradePanel` only uses Jupiter (`useJupiterSwap`), which doesn't support tokens still on Pump.fun's bonding curve. Jupiter only routes for graduated/migrated tokens with DEX liquidity.

### Root Cause
- The `UniversalTradePanel` bypasses the smart routing in `useRealSwap` and calls Jupiter directly.
- For Pump.fun bonding curve tokens, Jupiter has no route since liquidity only exists on the Pump.fun bonding curve.
- The platform needs a **Pump.fun swap** path similar to how it already has Meteora DBC swap for its own bonding curve tokens.

### Solution

#### 1. Add Pump.fun Swap Edge Function
Create a new edge function `pumpfun-swap` that uses the **Pump.fun API** (or the QuickNode Metis endpoint which wraps Jupiter + Pump.fun) to build swap transactions for bonding curve tokens.

- The Pump.fun API at `https://pumpportal.fun/api/trade-local` accepts a mint address, SOL amount, and returns a serialized transaction.
- Alternatively, use the public Jupiter API which has recently added Pump.fun as a liquidity source -- but we need to confirm route availability.

**Recommended approach**: Use the **PumpPortal API** (`https://pumpportal.fun/api/trade-local`) which provides direct bonding curve swaps without requiring extra API keys.

#### 2. Create `usePumpFunSwap` Hook
A new hook that:
- Gets a quote from the Pump.fun bonding curve
- Builds the swap transaction via the PumpPortal API
- Signs and sends via the Privy embedded wallet (`signAndSendTransaction`)

#### 3. Upgrade `UniversalTradePanel` to Smart Routing
Instead of only using Jupiter, detect the token's status:
- **If `migrated: true` or `completed: true`** (from the `ExternalToken` data) -> Use Jupiter
- **If still on bonding curve** (from Codex launchpad data) -> Use Pump.fun swap
- Show the routing source in the UI ("via Jupiter" vs "via Pump.fun")
- Remove "No route found" -- if Jupiter fails, try Pump.fun automatically

#### 4. Pass Token Context to Trade Panel
The `ExternalTokenView` already passes basic token info to `UniversalTradePanel`. We need to also pass:
- `completed` / `migrated` status (to determine swap route)
- `graduationPercent` (for UI display)

#### 5. Fix Trades Tab
The trades may be empty because Codex needs time to index very new tokens. Add:
- A "No trades found for this token yet" message with a note that data may take time to appear
- Auto-retry with shorter intervals for new tokens

### Technical Changes

| File | Change |
|------|--------|
| `supabase/functions/pumpfun-swap/index.ts` | **New** -- Edge function to proxy PumpPortal swap transaction building |
| `src/hooks/usePumpFunSwap.ts` | **New** -- Hook for Pump.fun bonding curve swaps via Privy wallet |
| `src/components/launchpad/UniversalTradePanel.tsx` | **Modify** -- Add smart routing: detect bonding curve vs graduated, use appropriate swap method, show route source |
| `src/hooks/useExternalToken.ts` | **Modify** -- Ensure `completed`/`migrated`/`graduationPercent` fields are passed through |
| `src/pages/FunTokenDetailPage.tsx` | **Modify** -- Pass full token context (including bonding status) to `UniversalTradePanel` |
| `src/components/launchpad/TokenDataTabs.tsx` | **Modify** -- Better empty state messaging for trades |
| `src/hooks/useRealSwap.ts` | **Modify** -- Add Pump.fun swap path alongside existing Meteora DBC and Jupiter paths |

### Swap Routing Logic

```text
Token Swap Request
       |
       v
  Is token graduated/migrated?
       |
      YES --> Jupiter Aggregator (existing)
       |
      NO --> Is it a platform DBC token?
              |
             YES --> Meteora DBC SDK (existing)
              |
             NO --> PumpPortal API (new)
                    Builds bonding curve tx
                    Sign via Privy wallet
```

### PumpPortal API Integration
The PumpPortal API (`https://pumpportal.fun/api/trade-local`) is free, requires no API key, and returns a serialized transaction:

```text
POST https://pumpportal.fun/api/trade-local
Body: {
  publicKey: "<user wallet>",
  action: "buy" | "sell",
  mint: "<token mint>",
  amount: <SOL amount for buy, token amount for sell>,
  denominatedInSol: "true",
  slippage: 5,
  priorityFee: 0.0005
}
Response: Raw transaction bytes (base64)
```

The edge function will proxy this to keep the architecture consistent and allow adding rate limiting or caching later.

