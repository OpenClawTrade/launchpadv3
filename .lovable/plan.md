
# Base Launchpad Implementation Plan
## Inspired by Flaunch.gg Model

---

## ✅ IMPLEMENTATION STATUS

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: EVM Wallet Integration | ✅ Complete | wagmi, viem, rainbowkit installed; EvmWalletProvider, useEvmWallet hook created |
| Phase 2: Smart Contracts | ⏳ Pending | Requires external Solidity development & deployment |
| Phase 3: Database Schema | ✅ Complete | Multi-chain columns added to fun_tokens; base_creator_claims, base_buybacks tables created |
| Phase 4: Edge Functions | ✅ Complete | base-create-token, base-pool-state, base-claim-fees, base-eth-price deployed |
| Phase 5: Base Launch UI | ✅ Complete | BaseLauncher, FeeSlider, EvmWalletCard components created |
| Phase 6: Buyback Engine | ⏳ Pending | Requires on-chain contract |

---

## Executive Summary

This plan implements a Base chain token launchpad modeled after Flaunch.gg's creator-first revenue model. The key innovation is **100% of trading fees go to creators and buybacks** (no platform extraction during trading), with the platform earning through liquidity yield instead.

---

## Flaunch Model Analysis

### How Flaunch Works

| Feature | Description |
|---------|-------------|
| **Launch Cost** | ~$30 to create a token |
| **Trading Fee** | 1% (Uniswap V4 hook) |
| **Creator Revenue** | 0-100% of trading fees (creator chooses, immutable) |
| **Community Share** | Remainder goes to Progressive Bid Walls (auto-buybacks) |
| **Platform Revenue** | ETH liquidity is wrapped into flETH via AAVE, earning ~2% yield |
| **Fair Launch** | 5-30 min fixed-price period, no sells allowed, CAPTCHA protection |
| **Royalty NFT** | Transferable NFT represents ownership of fee stream |

### Creator Earnings Example
For a token doing $100,000 daily volume with 1% fee and 80% creator share:
- Daily fees: $1,000
- Creator receives: $800/day (paid in ETH on every swap)
- Community buybacks: $200/day

---

## TUNA Base Implementation Strategy

### Phase 1: EVM Wallet Integration

**Dependencies to Install:**
```
wagmi ^2.x
viem ^2.x
@rainbow-me/rainbowkit ^2.x
```

**New Files:**
```
src/providers/EvmWalletProvider.tsx    - Wagmi + RainbowKit config
src/hooks/useEvmWallet.ts              - EVM wallet state hook
src/components/launchpad/EvmWalletCard.tsx - Connect/display component
```

**Integration Points:**
- Wrap app with `WagmiProvider` + `RainbowKitProvider`
- Conditional rendering: Privy wallet for Solana, RainbowKit for EVM chains
- Header shows connected address based on active chain

---

### Phase 2: Smart Contract Architecture

**Core Contracts (Solidity):**

```text
contracts/
├── TunaTokenFactory.sol      - Factory for creating ERC20 tokens
├── TunaFeeHook.sol           - Uniswap V4 hook for fee distribution
├── TunaCreatorVault.sol      - Stores creator fee streams
└── TunaBuybackEngine.sol     - Progressive bid wall equivalent
```

**Token Factory Design:**
```
┌─────────────────────────────────────────────────────────────┐
│                    TunaTokenFactory                          │
├─────────────────────────────────────────────────────────────┤
│ createToken(                                                │
│   name: string,                                             │
│   symbol: string,                                           │
│   creatorFeeBps: uint16,     // 0-10000 (0-100%)           │
│   creator: address,                                         │
│   fairLaunchDuration: uint32 // seconds                     │
│ ) → tokenAddress, poolAddress                               │
├─────────────────────────────────────────────────────────────┤
│ Events:                                                     │
│ - TokenCreated(tokenAddress, poolAddress, creator)          │
│ - FeesDistributed(tokenAddress, creatorAmount, buybackAmt)  │
└─────────────────────────────────────────────────────────────┘
```

**Fee Distribution Flow:**
```text
                    1% Trading Fee
                          │
          ┌───────────────┴───────────────┐
          │                               │
   Creator Share (0-100%)          Community Share
          │                               │
          ▼                               ▼
   ┌─────────────┐               ┌─────────────────┐
   │ CreatorVault│               │ BuybackEngine   │
   │ (claimable) │               │ (limit orders)  │
   └─────────────┘               └─────────────────┘
```

---

### Phase 3: Database Schema Updates

```sql
-- Add multi-chain support to fun_tokens
ALTER TABLE public.fun_tokens 
  ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'solana',
  ADD COLUMN IF NOT EXISTS chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS evm_token_address TEXT,
  ADD COLUMN IF NOT EXISTS evm_pool_address TEXT,
  ADD COLUMN IF NOT EXISTS evm_factory_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS creator_fee_bps INTEGER DEFAULT 8000,  -- 80% default like Flaunch
  ADD COLUMN IF NOT EXISTS fair_launch_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fair_launch_supply_pct INTEGER DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_fun_tokens_chain ON public.fun_tokens(chain);
CREATE INDEX IF NOT EXISTS idx_fun_tokens_chain_id ON public.fun_tokens(chain_id);

-- Creator fee claims for Base tokens
CREATE TABLE IF NOT EXISTS public.base_creator_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  claimed_eth NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now()
);

-- Buyback events tracking
CREATE TABLE IF NOT EXISTS public.base_buybacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  eth_amount NUMERIC NOT NULL,
  tokens_bought NUMERIC,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Phase 4: Backend Edge Functions

**New Edge Functions:**

| Function | Purpose |
|----------|---------|
| `base-create-token` | Deploy ERC20 + create Uniswap pool |
| `base-add-liquidity` | Add initial ETH/token liquidity |
| `base-claim-fees` | Creator claims accumulated fees |
| `base-pool-state` | Get token price, volume, TVL |
| `base-eth-price` | ETH price feed |

**Token Creation Flow:**
```text
1. Frontend → base-create-token
2. Edge function prepares transaction data
3. Returns unsigned tx to frontend
4. User signs with MetaMask/WalletConnect
5. Frontend broadcasts signed tx
6. Edge function polls for confirmation
7. Records token in database
```

---

### Phase 5: Base Launch UI

**New Components:**
```
src/pages/BaseLauncherPage.tsx           - Main Base launch page
src/components/launchpad/BaseLauncher.tsx - Launch form component
src/components/launchpad/FeeSlider.tsx    - Creator/buyback split slider
src/components/launchpad/FairLaunchBadge.tsx - Fair launch countdown
src/components/launchpad/BaseTokenCard.tsx - Token display for Base
```

**Launch Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| Token Name | text | Max 32 chars |
| Symbol | text | Max 10 chars |
| Description | textarea | Max 500 chars |
| Image | file/url | Token logo |
| Creator Fee % | slider | 0-100% (default 80%) |
| Fair Launch Duration | select | 5/15/30 min |
| Fair Launch Supply | select | 5%/10%/20% |
| Starting MCAP | input | Min $1,000 |
| Website/Twitter | optional | Social links |

**UI Comparison:**

| Feature | Solana (Current) | Base (New) |
|---------|------------------|------------|
| Wallet | Privy/Phantom | RainbowKit |
| Currency | SOL | ETH |
| Fee Display | 2% to treasury | X% to creator, Y% to buybacks |
| Launch Cost | Free (treasury pays) | User pays gas (~$1-5) |
| LP | Meteora DBC | Uniswap V3/V4 |

---

### Phase 6: Progressive Bid Wall (Buyback Engine)

**Simplified Implementation:**
Instead of complex Uniswap V4 hooks, implement a simpler version:

1. Community fee share accumulates in a contract
2. Every 0.05 ETH, place a limit order below current price
3. Orders execute when price hits them (auto-buyback)
4. Bought tokens can be burned or held by contract

**Contract Logic:**
```text
accumulator >= 0.05 ETH?
    │
    ├─ Yes → Create limit order at (spot_price * 0.99)
    │        Reset accumulator
    │
    └─ No → Continue accumulating
```

---

## Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** | 2-3 days | Wagmi/RainbowKit integration, EVM wallet hook |
| **Phase 2** | 5-7 days | Smart contracts (TunaTokenFactory, FeeHook) |
| **Phase 3** | 1 day | Database migrations |
| **Phase 4** | 3-4 days | Edge functions for Base operations |
| **Phase 5** | 2-3 days | Base launcher UI with fee slider |
| **Phase 6** | 3-4 days | Buyback engine implementation |

**Total: ~3 weeks**

---

## Technical Considerations

### RPC & API Keys
```env
BASE_RPC_URL=https://mainnet.base.org  # or Alchemy/Infura
BASE_CHAIN_ID=8453
```

### Contract Deployment Strategy
1. Deploy `TunaTokenFactory` once on Base mainnet
2. Store factory address in config
3. Each token launch calls `factory.createToken(...)`
4. Factory handles ERC20 deployment + Uniswap pool creation

### Gas Estimates (Base)
| Operation | Estimated Gas | Cost (~$2 ETH, 1 gwei) |
|-----------|---------------|------------------------|
| Create Token | ~200k | ~$0.40 |
| Create Pool | ~300k | ~$0.60 |
| Add Liquidity | ~200k | ~$0.40 |
| **Total** | ~700k | **~$1.40** |

### Security Considerations
1. Factory contract needs audit before mainnet
2. Rate limiting per wallet address
3. CAPTCHA during fair launch period
4. Creator fee % is immutable after launch

---

## Revenue Model Comparison

| Metric | Pump.fun | Flaunch | TUNA Base |
|--------|----------|---------|-----------|
| Platform Trading Fee | 1% | 0% | 0% |
| Creator Fee | 0% | 0-100% | 0-100% |
| Platform Revenue | Fees | Yield on liquidity | Small launch fee + yield |
| Creator Potential | $0 | $XXX per $10k vol | $XXX per $10k vol |

---

## Next Steps After Approval

1. Install wagmi, viem, rainbowkit dependencies
2. Create EvmWalletProvider with Base mainnet config
3. Update ChainContext to enable Base
4. Build BaseLauncher component with fee slider
5. Draft Solidity contracts (can use existing templates)
6. Create base-create-token edge function
7. Test end-to-end on Base Sepolia testnet
8. Deploy to mainnet after testing

---

## Files to Create/Modify

**New Files (15+):**
- `src/providers/EvmWalletProvider.tsx`
- `src/hooks/useEvmWallet.ts`
- `src/components/launchpad/BaseLauncher.tsx`
- `src/components/launchpad/FeeSlider.tsx`
- `src/components/launchpad/EvmWalletCard.tsx`
- `src/pages/BaseLauncherPage.tsx`
- `supabase/functions/base-create-token/index.ts`
- `supabase/functions/base-pool-state/index.ts`
- `supabase/functions/base-claim-fees/index.ts`
- `contracts/TunaTokenFactory.sol`
- `contracts/TunaFeeHook.sol`

**Modified Files:**
- `src/contexts/ChainContext.tsx` - Enable Base chain
- `src/pages/FunLauncherPage.tsx` - Route to BaseLauncher
- `src/App.tsx` - Wrap with EvmWalletProvider
- Database migrations for multi-chain support
