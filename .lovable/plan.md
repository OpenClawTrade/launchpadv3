

## Why $VITALIK shows $5 market cap (and why it's actually correct)

### Investigation results

I tested the live data path end-to-end:

1. **`eth-batch-market` fix is deployed and working** — it correctly prefers `fdv` over `marketCap`.
2. **DexScreener is returning `fdv: 5` AND `marketCap: 5`** for this specific token. They're identical, so the FDV preference doesn't change anything here.
3. **The $5 number is the honest on-chain reality.**

### Raw DexScreener data for `0xa0df…3bfe` ($VITALIK)

```
priceUsd:    0.000000005046    ($5.046e-9 per token)
liquidity:   $10.17 USD
  - base:    999,999,999 VITALIK (entire supply)
  - quote:   0.002224 WETH (~$10 — basically empty)
fdv:         5
marketCap:   5
priceChange.h24: -87.44%
```

### What actually happened

The pool was seeded with a small ETH amount (the default minimum is 0.001 ETH = ~$3, configurable up to 10 ETH per launch). After launch, **0.002 WETH** is what's left in the pool against the full 1B supply. With a 24h change of **-87.44%**, this is consistent with sells draining the WETH side of the V3 single-sided position.

Math check: `5.046e-9 × 1,000,000,000 = $5.05` ✅ — that **is** the FDV. The token genuinely trades at $5 FDV right now because the marginal price collapsed. There is no "wrong number" to swap for a "right number".

### Why the previous fix worked for some tokens but not this one

The earlier bug — DexScreener reporting `marketCap` as ~LP value while `fdv` shows the real number — happens on **fresh, untraded tokens** where DexScreener's circulating-supply heuristic excludes the LP-locked tokens. For $VITALIK, **trades have happened** (2 buys, 1 sell in 24h), DexScreener now treats the supply as circulating, and `fdv === marketCap`. Both reflect the post-dump price.

### What to do

Three options, pick one:

**Option A — Do nothing (recommended).** The $5 is accurate. Showing a fake $100K when the token actually trades at $5 FDV would mislead users and erode trust. The `-87.4% / 24h` red ticker already tells the story.

**Option B — Show "intended launch MC" badge.** Add a small "Launched at: $X" label next to the live MC, computed from `lp_eth × ETH_USD × 1B / lp_seed_tokens`. This shows where the token started without lying about where it is now.

**Option C — Hide the hero card when liquidity < $50.** If a token's pool has effectively no liquidity, treat it as "deploying" or "drained" and skip the hero spotlight entirely so dead tokens don't sit at the top of the page. Requires a check on `market.liquidityUsd` in `injectHeroCard`.

### Files involved (no changes needed unless you pick B or C)

- `supabase/functions/eth-batch-market/index.ts` — already correct
- `src/pages/PopshibaLaunchpadPage.tsx` (`injectHeroCard`, line 218) — would change here for Option B or C

Tell me which option (A / B / C) and I'll implement it.

