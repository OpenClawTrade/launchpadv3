
# Fix: Monitor Not Selling Full Balance (Token-2022 Support)

## Problem

The $PENG stop-loss only sold **78,702 tokens** instead of the full **4,627,311** because the monitor queries token balances using the **default SPL Token program only**. If $PENG is a Token-2022 token, `getParsedTokenAccountsByOwner({ mint })` returns 0 or a partial/wrong account from the standard program. The monitor then sells whatever tiny amount it finds.

The `trading-agent-force-sell` function already handles both programs correctly -- the monitor needs the same fix.

## Fix

### File: `supabase/functions/trading-agent-monitor/index.ts`

**Lines 304-317** -- Replace the single `getParsedTokenAccountsByOwner` call with a dual-program lookup (SPL Token + Token-2022), matching the pattern used in `force-sell`:

```
// Add constants at top of file:
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// Replace lines 304-317:
// Check BOTH SPL Token and Token-2022 programs
const mintPubkey = new PubKey(position.token_address);
const [splAccounts, t22Accounts] = await Promise.all([
  connection.getParsedTokenAccountsByOwner(
    agentKeypair.publicKey, { mint: mintPubkey }
  ).catch(() => ({ value: [] })),
  connection.getParsedTokenAccountsByOwner(
    agentKeypair.publicKey, 
    { programId: TOKEN_2022_PROGRAM }
  ).then(res => ({
    value: res.value.filter(a => 
      a.account.data.parsed?.info?.mint === position.token_address
    )
  })).catch(() => ({ value: [] })),
]);

const allAccounts = [...splAccounts.value, ...t22Accounts.value];
let amountToSell = 0;
for (const acc of allAccounts) {
  const raw = acc.account.data.parsed?.info?.tokenAmount?.amount;
  if (raw) amountToSell += parseInt(raw);
}
```

This ensures the monitor finds and sells the **full balance** regardless of whether the token uses SPL Token or Token-2022.

## Immediate Recovery

After deploying, trigger `trading-agent-force-sell` for the remaining $PENG tokens still in the wallet (the stop-loss only sold a fraction).
