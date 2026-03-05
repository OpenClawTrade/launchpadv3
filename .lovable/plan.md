

## Populate Bought, Sold, and PnL columns in the Holders Table

### Current State
The HoldersTable shows "—" placeholders for Bought (Avg Buy), Sold (Avg Sell), and U. PnL columns. The trade data already exists — `useCodexTokenEvents` fetches all trades with maker address, amounts, and USD prices. We just need to cross-reference holders with their trades.

### Approach
Use the **existing Codex trade events** data (already fetched in `TokenDataTabs`) to compute per-holder trade stats. No new API calls or edge functions needed.

### Changes

#### 1. `src/components/launchpad/TokenDataTabs.tsx`
- Pass the full trade events list and current token price USD to `HoldersTable` as new props
- Add `currentPriceUsd` prop from parent (already available in FunTokenDetailPage via Codex enrichment)

#### 2. `src/components/launchpad/HoldersTable.tsx`
- Accept new props: `trades: TokenTradeEvent[]` and `currentPriceUsd: number`
- Build a per-holder stats map from trades:
  - **totalBoughtUsd**: sum of all Buy `totalUsd` for this maker
  - **totalBoughtTokens**: sum of all Buy `tokenAmount`
  - **avgBuyPrice**: `totalBoughtUsd / totalBoughtTokens`
  - **totalSoldUsd**: sum of all Sell `totalUsd`
  - **totalSoldTokens**: sum of all Sell `tokenAmount`
  - **avgSellPrice**: `totalSoldUsd / totalSoldTokens`
  - **remainingTokens**: from holder data (already have)
  - **unrealizedValueUsd**: `remainingTokens * currentPriceUsd`
  - **costBasisOfRemaining**: `remainingTokens * avgBuyPrice`
  - **unrealizedPnlUsd**: `unrealizedValueUsd - costBasisOfRemaining + totalSoldUsd - totalBoughtUsd` (realized + unrealized)
  - **pnlPercent**: `(pnlUsd / totalBoughtUsd) * 100`
- Display in the table:
  - **Bought (Avg Buy)**: `$1.2K ($0.0023)` — total bought USD + avg buy price
  - **Sold (Avg Sell)**: `$800 ($0.0031)` — total sold USD + avg sell price, or "—" if no sells
  - **U. PnL**: `+$420 (+35%)` in green, or `-$120 (-8%)` in red. Show `—` if no trade data

#### 3. `src/pages/FunTokenDetailPage.tsx`
- Pass `currentPriceUsd` (from Codex enrichment) down to `TokenDataTabs`

#### 4. `src/components/launchpad/TokenDataTabs.tsx`
- Accept `currentPriceUsd` prop and forward it along with `data?.events` to `HoldersTable`

