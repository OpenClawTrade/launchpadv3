

## Fix: Edge Function Drops Ephemeral Keypairs

### Root Cause

The `fun-phantom-create` edge function acts as a proxy to the Vercel API (`api/pool/create-phantom`). The Vercel API correctly returns:
- `ephemeralKeypairs` (secret keys for mint/config keypairs)
- `txRequiredKeypairs` (which keypairs each transaction needs)
- `txIsVersioned` (whether each tx is legacy or V0)
- `txLabels` (human-readable labels for each transaction)

But the edge function response at line 353-371 only forwards `unsignedTransactions`. All the signing metadata is thrown away.

The frontend expects `data.ephemeralKeypairs` (line 1101) but it's always `undefined`. So the post-Phantom ephemeral signing never runs. Transactions go out missing required signatures. Validators drop them. Polling finds nothing.

### The Fix

Forward the missing fields from the Vercel API response through the edge function response.

### File: `supabase/functions/fun-phantom-create/index.ts`

**Lines 353-367** -- add the missing fields from `poolData` to the response:

```text
return new Response(
  JSON.stringify({
    success: true,
    name: name.slice(0, 50),
    ticker: ticker.toUpperCase().slice(0, 5),
    mintAddress,
    dbcPoolAddress,
    imageUrl: storedImageUrl,
    unsignedTransactions,
    txLabels: poolData.txLabels || [],           // NEW
    txRequiredKeypairs: poolData.txRequiredKeypairs || [],  // NEW
    ephemeralKeypairs: poolData.ephemeralKeypairs || {},     // NEW
    txIsVersioned: poolData.txIsVersioned || [],  // NEW
    vanityKeypairId: poolData.vanityKeypairId || null,      // NEW
    onChainSuccess: false,
    solscanUrl: `https://solscan.io/token/${mintAddress}`,
    tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}`,
    message: "Ready for Phantom signature.",
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

That's the entire fix. One file, five fields forwarded. The frontend signing logic is already correct -- it just never receives the data it needs.

