

## Reliable Wallet Scanning, Live Position Display, and Clean Sell-All

### The Problem

The current system has a trust gap:
1. The force-sell function already supports `sellAll` mode that scans the wallet on-chain via `getParsedTokenAccountsByOwner` -- this is the correct approach
2. BUT there's no UI to **see** what tokens are actually in the wallet before selling
3. Database positions (`trading_agent_positions`) can get out of sync with on-chain reality (tokens bought but DB not updated, or tokens already sold but DB still shows "open")
4. There's no admin "Sell All" button in the frontend -- you have to call the edge function manually

### What We'll Build

#### 1. New Edge Function: `trading-agent-wallet-scan`
A read-only function that scans the agent's wallet on-chain and returns all token holdings with live data:
- Uses `getParsedTokenAccountsByOwner` to get ALL SPL token accounts
- For each token with a non-zero balance, fetches a Jupiter quote (token -> SOL) to get current value
- Cross-references with `trading_agent_positions` DB table to identify tracked vs untracked tokens
- Returns a unified list showing: mint address, token name/symbol, on-chain balance, estimated SOL value, whether it has a matching DB position

#### 2. New UI Component: "On-Chain Wallet Holdings" Panel
Added to the `TradingAgentProfilePage` in the Positions tab, above the existing DB-based positions list:
- A "Scan Wallet" button that calls the new edge function
- Shows a table/card list of ALL tokens found on-chain in the wallet
- Each row shows: token name, mint (linked to Solscan), balance, estimated value in SOL
- Tags each token as "Tracked" (has DB position) or "Untracked" (on-chain only, no DB record)
- Shows the wallet SOL balance as well

#### 3. Admin "Sell All Tokens" Button
A prominent button on the agent profile page (behind admin/beta check) that:
- Calls `trading-agent-force-sell` with `sellAll: true`
- Shows a confirmation dialog first ("This will sell ALL tokens in the wallet and close all positions")
- Displays results after execution: which tokens sold, which failed, SOL received
- Auto-refreshes the wallet scan and positions after completion

#### 4. Fix Force-Sell Reliability
Improve the existing `trading-agent-force-sell` function:
- Add Token-2022 program support (scan both `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` AND `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- Increase slippage for truly illiquid tokens (try 15% first, retry at 25% if it fails, then 50%)
- Add retry logic per token (up to 3 attempts with increasing slippage)
- Close empty token accounts after selling to reclaim rent SOL
- Log failed sells clearly so we know exactly what couldn't be sold and why

### Technical Details

```text
+------------------+       +------------------------+       +------------------+
| UI: Scan Button  | ----> | trading-agent-wallet-  | ----> | Solana RPC       |
|                  |       | scan (new edge fn)     |       | (Helius)         |
+------------------+       +------------------------+       +------------------+
                                     |                              |
                                     | cross-reference              | getParsedToken
                                     v                              | AccountsByOwner
                           +------------------------+               |
                           | trading_agent_positions |              |
                           | (DB table)             |              |
                           +------------------------+       +------v-----------+
                                                           | Jupiter V1 API   |
+------------------+       +------------------------+      | (quote for value)|
| UI: Sell All Btn | ----> | trading-agent-force-   |      +------------------+
|                  |       | sell (existing, improved)|
+------------------+       +------------------------+
```

**Files to create:**
- `supabase/functions/trading-agent-wallet-scan/index.ts` -- new edge function

**Files to modify:**
- `supabase/functions/trading-agent-force-sell/index.ts` -- add Token-2022 support, retry with escalating slippage, rent reclaim
- `src/pages/TradingAgentProfilePage.tsx` -- add wallet scan panel, sell-all button
- `src/hooks/useTradingAgents.ts` -- add `useWalletScan` and `useForceSellAll` hooks

**No database changes needed** -- this is purely on-chain reads + existing edge function improvements + UI.

