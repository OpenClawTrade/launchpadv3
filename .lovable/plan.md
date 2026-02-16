

## FUN MODE - Direct Pool Launch (No Bonding Curve)

### Overview
A new admin-only launch mode called "FUN" that creates tokens directly on a Meteora DAMM V2 (CP-AMM) pool -- bypassing the bonding curve entirely. This creates tokens with artificially high implied market caps that show inflated USD values in wallets like Phantom and Jupiter.

### How The "Show Off" Trick Works
1. Mint a token with a small circulating supply (e.g., 100K-10M tokens)
2. Create a DAMM V2 pool with very little SOL liquidity (e.g., 0.1-1 SOL) against the tokens
3. The pool price = SOL deposited / tokens deposited, so small SOL + small tokens = high price per token
4. Phantom/Jupiter reads this pool price and multiplies by holdings, showing inflated USD values (e.g., $30,000)
5. LP is NOT locked -- creator can withdraw it anytime
6. Zero trading fees so friends can "trade" freely

**Example math:** 1 SOL (~$150) liquidity against 100,000 tokens = $0.0015/token. Give someone 20M tokens (from unminted reserve) and Phantom shows ~$30,000 in their wallet. The actual redeemable value is near zero due to thin liquidity.

### Access Control
- Admin password gate: user must enter password "tuna" to unlock the FUN mode tab (consistent with Tunnel tool pattern using localStorage)
- Mode only visible after password entry

### Architecture

The key difference from existing modes: FUN mode does NOT use the DBC (Dynamic Bonding Curve) SDK. Instead it uses the **CP-AMM SDK** (`@meteora-ag/cp-amm-sdk`) which is already installed, to create a direct DAMM V2 pool.

### New Backend: `api/pool/create-fun-mode.ts` (Vercel API)

Creates a token + DAMM V2 pool in one flow:

1. Create SPL token mint (using treasury or vanity address)
2. Mint configurable supply to creator wallet
3. Create DAMM V2 pool via `CpAmm.createCustomPool`:
   - Token A = new token, Token B = wSOL
   - `isLockLiquidity: false` (LP NOT locked)
   - Zero base fees (`startingFeeBps: 0, endingFeeBps: 0`)
   - No dynamic fees
   - Immediate activation
4. Return unsigned transactions for Phantom signing (same 2-TX sequential flow)

**Parameters:**
- `name`, `ticker`, `description`, `imageUrl` (standard)
- `totalSupply` (configurable, default 1,000,000,000)
- `lpTokenAmount` (how many tokens to seed into pool)
- `lpSolAmount` (how much SOL to seed into pool, e.g., 0.1 SOL)
- `phantomWallet` (creator/payer)

### New Edge Function: `fun-mode-create`

Thin proxy (same pattern as `fun-phantom-create`) that forwards to the Vercel API and returns serialized transactions.

### Frontend Changes

**`src/components/launchpad/TokenLauncher.tsx`:**

1. Add `"fun"` to the `generatorMode` union type
2. Add FUN mode to the modes array (with Coins icon), hidden until admin password entered
3. Add password gate state (localStorage key `fun_mode_unlocked`)
4. Add FUN-specific state: `funLpSol` (default 0.5), `funLpTokens` (default 10,000,000), `funTotalSupply` (default 1,000,000,000)

**FUN mode UI panel:**
- Password input (shown once, stored in localStorage)
- Token name/ticker/description/image (reuse existing custom form)
- "Total Supply" input (how many tokens to mint)
- "LP SOL" slider (0.01 - 5 SOL, how much SOL in pool)
- "LP Tokens" input (how many tokens to seed in pool)
- Calculated display: "Implied price per token", "Implied market cap"
- Warning badge: "LP is NOT locked -- for fun only"
- Launch button triggers `handleFunLaunch` using same 2-TX sequential Phantom signing

### Database
- FUN mode tokens are stored in existing `fun_tokens` table with a new flag or `launch_type = 'fun_mode'` to distinguish them
- No bonding curve state needed (no `tokens` table entry)

### Technical Details

**CP-AMM pool creation via SDK:**
```text
import { CpAmm } from "@meteora-ag/cp-amm-sdk";

const cpAmm = new CpAmm(connection);
const { initSqrtPrice, liquidityDelta } = cpAmm.preparePoolCreationParams({
  tokenAAmount: new BN(lpTokenAmount * 10**9),
  tokenBAmount: new BN(lpSolLamports),
  minSqrtPrice: MIN_SQRT_PRICE,
  maxSqrtPrice: MAX_SQRT_PRICE,
});

// Zero fees, no lock, immediate activation
const { tx, pool, position } = await cpAmm.createCustomPool({
  payer, creator,
  positionNft: positionNftMint,
  tokenAMint: newTokenMint,
  tokenBMint: WSOL_MINT,
  tokenAAmount, tokenBAmount,
  sqrtMinPrice: MIN_SQRT_PRICE,
  sqrtMaxPrice: MAX_SQRT_PRICE,
  initSqrtPrice, liquidityDelta,
  poolFees: { baseFee: zeroFeeConfig, padding: [] },
  hasAlphaVault: false,
  collectFeeMode: 0,
  activationPoint: new BN(0),
  activationType: 0, // slot-based, immediate
  isLockLiquidity: false,
});
```

**Files to create:**
- `api/pool/create-fun-mode.ts`
- `supabase/functions/fun-mode-create/index.ts`

**Files to modify:**
- `src/components/launchpad/TokenLauncher.tsx` (add FUN mode tab + UI + launch handler)

