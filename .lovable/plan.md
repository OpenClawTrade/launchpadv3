

## Enrich Creator Fee Payouts in Recent Activity

### Problem
When the treasury wallet sends creator earnings, it shows as a generic "Received" with the raw treasury address (see screenshot). Users can't tell this is a fee payout or which token it's from.

### Solution
Enrich transactions in `fetch-wallet-transactions` edge function: when a "receive" comes from the treasury wallet, cross-reference with `fun_distributions` / `claw_distributions` tables to find the matching token name, and update the description and type label.

### Changes

#### 1. `supabase/functions/fetch-wallet-transactions/index.ts`
After parsing transactions, add an enrichment step:
- Identify "receive" transactions where `counterparty === TREASURY_WALLET`
- For those, query `fun_distributions` and `claw_distributions` by signature to find the associated `fun_token_id`
- Join with `fun_tokens` to get token name/ticker
- Update the transaction's `description` to e.g. `"Creator fee payout · TokenName ($TICKER)"` and add a new field like `label: "Fee Payout"` or keep type as `"receive"` but with enriched description

#### 2. `src/components/wallet/WalletTransactionHistory.tsx`
- Add a new type config entry for `"fee_payout"` with a distinct icon (e.g. coins/banknote icon) and gold/yellow color
- When rendering, detect fee payouts via the enriched data and display the token name instead of a truncated address

#### 3. `src/hooks/useWalletTransactions.ts`
- Add optional `label` and `tokenName` fields to the `WalletTransaction` interface

### Detail

In the edge function, after building the `transactions` array (line ~124), add:

```typescript
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Find receive txs from treasury
const treasuryReceives = transactions.filter(
  t => t.type === "receive" && t.counterparty === TREASURY_WALLET
);

if (treasuryReceives.length > 0) {
  // Look up distributions by signature to find token info
  const sigs = treasuryReceives.map(t => t.signature);
  const { data: dists } = await sb
    .from("fun_distributions")
    .select("signature, fun_token_id, fun_tokens(name, ticker)")
    .in("signature", sigs);
  // Also check claw_distributions
  // Build a sig→tokenInfo map and enrich each transaction
}
```

On the frontend, `WalletTransactionHistory` will check for the new `label` field and render a gold "Fee Payout" badge with the token name, replacing the generic "Received" + address display.

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/fetch-wallet-transactions/index.ts` | Enrich treasury receives with distribution/token data |
| `src/hooks/useWalletTransactions.ts` | Add `label` and `tokenName` optional fields to interface |
| `src/components/wallet/WalletTransactionHistory.tsx` | Add `fee_payout` type with gold icon, show token name |

