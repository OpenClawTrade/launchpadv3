

## FUN Mode Enhancements: Preset Suggestions, Fun Tone, and Remove LP Button

### Overview
Three improvements to the FUN mode section:
1. **Preset suggestions** showing exactly what values to enter to make a wallet show ~$30K, ~$100K, or ~$1M
2. **Fun, non-serious tone** with playful copy and a "Surprise a friend" vibe
3. **Remove LP button** so non-technical users can easily pull their liquidity back after the joke

---

### 1. Preset Suggestion Cards

Add clickable preset cards above the pool configuration that auto-fill the values:

| Preset | Total Supply | LP Tokens | LP SOL | Tokens to Friend | Phantom Shows |
|--------|-------------|-----------|--------|-------------------|---------------|
| "$30K Flex" | 1,000,000,000 | 100,000 | 0.01 | 20,000,000 | ~$30,000 |
| "$100K Baller" | 1,000,000,000 | 50,000 | 0.01 | 20,000,000 | ~$100,000 |
| "$1M Whale" | 1,000,000,000 | 10,000 | 0.01 | 50,000,000 | ~$1,000,000+ |

Clicking a preset fills `funTotalSupply`, `funLpTokens`, `funLpSol` automatically and shows a toast like "Values set for the $30K flex!"

The math explanation will be shown below the presets:
- "How it works: You put tiny SOL in pool with few tokens. Pool price = SOL / tokens. Phantom multiplies that price by your friend's holdings. Boom -- instant millionaire (on paper)."

### 2. Fun Tone Overhaul

Replace the current warning banner and copy with playful text:

- **Header**: "FUN Mode -- Prank Your Friends" with PartyPopper icon
- **Subtitle**: "Surprise a friend by sending them $1,000,000 worth of tokens (wink wink). Just pick a preset below and launch!"
- **Warning badge** changed from serious "LP is NOT locked" to: "This is FUN mode -- not financial advice, just vibes. LP is not locked so you can pull it back anytime."
- **Implied Values section header**: "What your friend will see in Phantom" instead of "Implied Values"
- **Holder wallet value label**: "Your friend's reaction" instead of "Holder wallet value"
- Add a small note: "Pro tip: Send the tokens to your friend's wallet after launch. They'll open Phantom and see $$$ -- priceless."

### 3. Remove LP Button (Post-Launch)

**New Vercel API: `api/pool/remove-fun-lp.ts`**

Uses the CP-AMM SDK's `removeAllLiquidityAndClosePosition()` method:
- Takes `poolAddress`, `positionNftMint`, and `phantomWallet` as inputs
- Fetches the pool state and position state from on-chain
- Builds an unsigned transaction to remove all liquidity and close the position
- Returns the serialized transaction for Phantom signing

Parameters needed:
- `poolAddress` -- the DAMM V2 pool address
- `phantomWallet` -- the owner wallet

**New Edge Function: `fun-mode-remove-lp/index.ts`**

Thin proxy to the Vercel API (same pattern as `fun-mode-create`).

**Frontend: New "Remove LP" section in TokenLauncher.tsx**

Add a collapsible section below the launch button (or a separate card) titled "Already launched? Remove your LP":
- Input field for the pool address (or auto-populate from the last launch result)
- "Remove LP and Get SOL Back" button
- On click: calls the edge function, gets unsigned TX, signs with Phantom, submits
- Shows toast on success: "LP removed! Your SOL is back in your wallet."
- Warning text: "This removes all liquidity. The token will become untradeable."

The remove LP flow stores the `poolAddress` from the most recent FUN launch in localStorage so the user doesn't have to re-enter it.

---

### Technical Details

**New files:**
- `api/pool/remove-fun-lp.ts` -- Vercel API endpoint using `CpAmm.removeAllLiquidityAndClosePosition()`
- `supabase/functions/fun-mode-remove-lp/index.ts` -- Edge function proxy

**Modified files:**
- `src/components/launchpad/TokenLauncher.tsx`:
  - Add preset cards array and click handlers to auto-fill values
  - Rewrite FUN mode copy to be playful/fun tone
  - Add `handleRemoveFunLp` callback
  - Add "Remove LP" UI section with pool address input and button
  - Store last launched pool address in state/localStorage

**`api/pool/remove-fun-lp.ts` approach:**
```text
const cpAmm = new CpAmm(connection);

// Fetch pool and position state
const poolState = await cpAmm.getPoolState(poolAddress);
// Find position NFT owned by the user
// Build removeAllLiquidityAndClosePosition TX
const txBuilder = cpAmm.removeAllLiquidityAndClosePosition({
  owner: phantomPubkey,
  position: positionPubkey,
  positionNftAccount: positionNftAccount,
  poolState,
  positionState,
  tokenAAmountThreshold: new BN(0),
  tokenBAmountThreshold: new BN(0),
  vestings: [],
  currentPoint: poolState.sqrtPrice,
});
// Serialize and return unsigned TX
```

**Preset click handler (frontend):**
```text
const FUN_PRESETS = [
  { label: "$30K Flex", supply: 1_000_000_000, lpTokens: 100_000, lpSol: 0.01, sendTokens: 20_000_000 },
  { label: "$100K Baller", supply: 1_000_000_000, lpTokens: 50_000, lpSol: 0.01, sendTokens: 20_000_000 },
  { label: "$1M Whale", supply: 1_000_000_000, lpTokens: 10_000, lpSol: 0.01, sendTokens: 50_000_000 },
];
// onClick: setFunTotalSupply, setFunLpTokens, setFunLpSol
```
