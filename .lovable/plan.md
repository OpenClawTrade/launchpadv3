

## Plan: BNB Chain Launchpad — Immediately DEX-Tradable Tokens

### Approach

Instead of a custom bonding curve, we deploy an ERC20 on BSC and **immediately create a PancakeSwap V2 liquidity pool** with initial BNB + token liquidity. The token is instantly tradable on PancakeSwap, Axiom, any BSC aggregator — no migration step needed.

This mirrors how many real BSC launches work: deploy token → add PancakeSwap liquidity → done.

### Changes

#### 1. Database Migration
- Add `backend_create_bnb_token` DB function (mirrors `backend_create_base_token` but with `chain = 'bnb'`, `chain_id = 56`)

#### 2. Edge Function: `bnb-create-token`
- Clone `base-create-token` pattern but target BSC (`bsc` chain from viem, RPC `https://bsc-dataseed.binance.org`)
- Deploy ERC20 contract (same `ClawToken` source, 1B supply)
- After deployment: approve PancakeSwap V2 Router, call `addLiquidityETH` to create a BNB/token pool with initial seed liquidity
- The deployer sends a small amount of BNB as initial liquidity (configurable, e.g. 0.1 BNB)
- Tokens are split: portion to liquidity pool, remainder to creator wallet
- Records in `fun_tokens` via `backend_create_bnb_token`
- Uses `BASE_DEPLOYER_PRIVATE_KEY` (same EVM key)

#### 3. Enable BNB Chain
**`src/providers/EvmWalletProvider.tsx`:**
- Import `bsc` from `wagmi/chains`
- Add to chains array and transports

**`src/contexts/ChainContext.tsx`:**
- Set `bnb.isEnabled = true`

**`src/hooks/useEvmWallet.ts`:**
- Add `isOnBnb`, `switchToBnb()` alongside existing `isOnBase`, `switchToBase`

#### 4. Frontend: `BnbLauncher.tsx`
- Clone `BaseLauncher` pattern
- BNB branding (yellow theme, PancakeSwap references)
- Form: name, ticker, description, image, socials
- Initial liquidity amount selector (0.05, 0.1, 0.5 BNB)
- Calls `bnb-create-token` edge function
- Shows BscScan link on success

#### 5. Page Integration
**`src/pages/FunLauncherPage.tsx`:**
- Add `chain === 'bnb'` branch rendering `<BnbLauncher />`
- Query `fun_tokens` filtered by `chain = 'bnb'` for token grid (future)

#### 6. Token Detail / Trading
- BNB tokens link directly to PancakeSwap for trading (like graduated Solana tokens link to Jupiter)
- No custom trade panel needed — DEX handles everything

### Files to Create/Modify
| File | Action |
|------|--------|
| DB migration | Create `backend_create_bnb_token` function |
| `supabase/functions/bnb-create-token/index.ts` | New edge function |
| `src/providers/EvmWalletProvider.tsx` | Add BSC chain |
| `src/contexts/ChainContext.tsx` | Enable BNB |
| `src/hooks/useEvmWallet.ts` | Add BNB helpers |
| `src/components/launchpad/BnbLauncher.tsx` | New component |
| `src/pages/FunLauncherPage.tsx` | Add BNB branch |

### PancakeSwap V2 Router Integration (Edge Function)
The key difference from `base-create-token`: after deploying the ERC20, the edge function:
1. Approves PancakeSwap V2 Router (`0x10ED43C718714eb63d5aA57B78B54917e56f3157`) to spend tokens
2. Calls `addLiquidityETH()` with seed BNB + tokens to create the pool
3. LP tokens go to deployer (can be locked/burned later)

Token is immediately tradable on any BSC DEX aggregator.

### No Additional Secrets Needed
`BASE_DEPLOYER_PRIVATE_KEY` works on BSC. Just needs BNB funded to the same address.

