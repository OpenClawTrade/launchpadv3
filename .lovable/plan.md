

## Plan: Build Our Own Flap-Style Bonding Curve System on BSC

### Problem
The current BNB launcher deploys a basic ERC20 and dumps 100% supply into PancakeSwap V2 LP. Flap's model uses a **bonding curve Portal contract** that acts as an on-chain AMM, enabling price discovery before DEX migration. The existing contracts in `contracts/flaunch/` are built for Uniswap V4 hooks on Base — they won't work on BSC.

### Architecture: What We Need to Build

We need a single **TunaPortal** factory contract on BSC that handles the entire token lifecycle:

```text
Creator calls newToken() on TunaPortal
        │
        ▼
┌──────────────────────────┐
│  BONDING CURVE PHASE     │
│  Portal deploys ERC20    │
│  Portal holds all tokens │
│  Users buy/sell vs Portal│
│  Constant product AMM    │
│  1% fee per trade        │
│  Fee split: creator/plat │
└──────────┬───────────────┘
           │ ~16 BNB collected
           ▼
┌──────────────────────────┐
│  GRADUATION              │
│  200M tokens + BNB LP    │
│  → PancakeSwap V3 pool   │
│  Trading continues on    │
│  DEX aggregators forever │
└──────────────────────────┘
```

### Key Parameters (matching Flap)
- **Total supply**: 1,000,000,000 tokens (18 decimals)
- **Bonding curve**: Constant product `(x + virtualBNB)(y + virtualTokens) = K`
- **Virtual reserves**: `r = 6.14 BNB`, `h = 107,036,752 tokens`
- **Graduation threshold**: ~16 BNB real reserve (800M tokens sold)
- **Trading fee**: 1% per swap
- **Fee split**: Configurable creator % (0-100%), remainder to platform
- **Post-graduation**: 200M remaining tokens + all BNB → PancakeSwap V3

### Changes

**1. Create `contracts/flaunch/TunaPortal.sol`** — The core BSC contract
- Factory that deploys ERC20 tokens via CREATE2 (vanity addresses ending in `8888`)
- Built-in constant-product bonding curve AMM (no Uniswap V4 dependency)
- `newToken(name, symbol, metadata, creatorFee)` — deploys token, mints 1B to Portal
- `buy(tokenAddress)` payable — user sends BNB, receives tokens from curve
- `sell(tokenAddress, amount)` — user sends tokens, receives BNB from curve
- `graduate(tokenAddress)` — when threshold met, creates PancakeSwap V3 pool with remaining tokens + BNB
- Fee collection: 1% on each trade, split between creator wallet and platform wallet
- Events for all trades (aggregators discover and route through these)
- Pure Solidity, no V4 hooks, no external dependencies beyond OpenZeppelin + PancakeSwap V3 router

**2. Create `supabase/functions/bnb-deploy-portal/index.ts`** — One-time Portal deployment
- Compiles and deploys TunaPortal.sol to BSC mainnet via the deployer wallet
- Stores the deployed Portal address in a secret (`BNB_PORTAL_ADDRESS`)
- Only needs to run once — all future token launches use this Portal

**3. Rewrite `supabase/functions/bnb-create-token/index.ts`** — Token launch via Portal
- Remove inline ERC20 compilation and PancakeSwap V2 LP logic
- Instead: call `Portal.newToken()` with creator's params + initial BNB buy as `msg.value`
- The Portal handles token deployment, bonding curve setup, and initial purchase
- Record token in `fun_tokens` table with bonding curve state

**4. Create `supabase/functions/bnb-swap/index.ts`** — Trade execution
- Calls `Portal.buy()` or `Portal.sell()` for bonding curve trades
- Used by the Quick Buy button and trade interface for BNB tokens still on the curve
- Post-graduation tokens route through PancakeSwap normally

**5. Update `src/components/launchpad/BnbLauncher.tsx`** — Match Flap's UI
- Remove "Seed Liquidity" selector (bonding curve handles this)
- Add "Initial Buy" field (optional BNB amount for creator's first purchase)
- Add creator fee % selector (0-100%)
- Update "How It Works" sidebar to explain bonding curve → graduation → PancakeSwap V3
- Add cover image upload (required)

**6. Database migration** — Add bonding curve fields to `fun_tokens`
- `bonding_curve_progress` (0-100%)
- `virtual_bnb_reserves`, `virtual_token_reserves`
- `real_bnb_reserves`, `real_token_reserves`
- `graduation_threshold_bnb`
- `portal_address` (the Portal contract used)

### What You Need To Do
- **Fund the deployer wallet** with ~0.5 BNB on BSC mainnet (for Portal deployment gas + initial token launches)
- **Run the Portal deployment once** (via the `bnb-deploy-portal` edge function or I can trigger it)
- No Remix needed — everything is automated through edge functions

### What's Automated
- Portal contract compilation + deployment (one-time)
- Token creation via Portal (every launch)
- Bonding curve trading
- Graduation to PancakeSwap V3 at threshold
- Database recording of all state

