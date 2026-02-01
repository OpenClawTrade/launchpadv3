# TUNA Multi-Chain Token Launch Roadmap

## Overview

Expand TUNA launchpad to support token launches on Base, Ethereum, and BNB Chain, with a unified header chain switcher and per-chain launch modes.

---

## Architecture Summary

| Chain | Status | Token Standard | LP/AMM | Wallet |
|-------|--------|---------------|--------|--------|
| **Solana** | ✅ Live | SPL Token | Meteora DBC | Privy (embedded/Phantom) |
| **Base** | 🔧 Next | ERC20 | Uniswap V3/V4 | MetaMask/WalletConnect |
| **Ethereum** | 📋 Planned | ERC20 | Uniswap V3 | MetaMask/WalletConnect |
| **BNB Chain** | 📋 Planned | BEP20 | PancakeSwap V3 | MetaMask/WalletConnect |

---

## Phase 1: Chain Switcher UI (Now)

### Header Implementation
- Add chain selector dropdown to `LaunchpadLayout.tsx` header
- Chain icons: Solana, Base, Ethereum, BNB
- Route-switching behavior: `/launch/solana`, `/launch/base`, etc.
- Store selected chain in React context + localStorage

### Routes Structure
```
/launch              → redirect to /launch/solana (default)
/launch/solana       → current launch modes (Random, Describe, Custom, Phantom, Holders)
/launch/base         → Base launch form (new)
/launch/ethereum     → Ethereum launch form (placeholder)
/launch/bnb          → BNB launch form (placeholder)
```

### Chain Context
```typescript
// src/contexts/ChainContext.tsx
type SupportedChain = 'solana' | 'base' | 'ethereum' | 'bnb';

interface ChainContextValue {
  chain: SupportedChain;
  setChain: (chain: SupportedChain) => void;
  chainConfig: ChainConfig;
}

interface ChainConfig {
  name: string;
  icon: string;
  rpcUrl: string;
  chainId?: number;
  nativeCurrency: { symbol: string; decimals: number };
  explorerUrl: string;
  isEnabled: boolean;
}
```

---

## Phase 2: EVM Wallet Integration

### Approach: Separate EVM Wallet (MetaMask/WalletConnect)
Since Privy is for Solana, add standalone EVM wallet support:

```
Dependencies:
- wagmi (React hooks for Ethereum)
- viem (TypeScript Ethereum library)
- @rainbow-me/rainbowkit OR @web3modal/wagmi
```

### Components
```
src/hooks/useEvmWallet.ts       - EVM wallet state & connection
src/providers/EvmWalletProvider.tsx - wagmi + RainbowKit provider
src/components/launchpad/EvmWalletConnect.tsx - Connect button for EVM
```

### Header Wallet Display
- Show Solana wallet when chain = solana
- Show EVM wallet when chain = base/ethereum/bnb
- Different connect buttons per chain type

---

## Phase 3: Base Token Launch (Native Build)

### Token Creation Flow
1. **Deploy ERC20**: Create standard ERC20 with fixed supply (1B)
2. **Create Uniswap V3 Pool**: ETH/Token pair with 1% fee tier
3. **Add Initial Liquidity**: Creator provides initial ETH + tokens
4. **Lock Liquidity**: Optional LP token lock for trust

### Smart Contracts Needed
```solidity
// contracts/TunaTokenFactory.sol
contract TunaTokenFactory {
  function createToken(
    string name,
    string symbol,
    uint256 initialSupply,
    address creator
  ) returns (address tokenAddress);
  
  function createPoolAndAddLiquidity(
    address token,
    uint256 tokenAmount,
    uint256 ethAmount
  ) returns (address poolAddress);
}
```

### Fee Structure (Base)
| Fee Type | Percentage | Recipient |
|----------|------------|-----------|
| Trading Fee | 1% | Pool (Uniswap standard) |
| Platform Fee | 0.5% (per trade) | TUNA Treasury |
| Creator Fee | Configurable 0-2% | Creator wallet |

### Backend Services
```
supabase/functions/base-create-token/index.ts
supabase/functions/base-add-liquidity/index.ts
supabase/functions/base-check-deployment/index.ts
api/base/deploy.ts (Vercel - may need longer timeout)
```

### Database Schema Addition
```sql
-- Multi-chain token support
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'solana';
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS chain_token_address TEXT;
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS chain_pool_address TEXT;
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS chain_tx_hash TEXT;
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS chain_id INTEGER;

CREATE INDEX idx_fun_tokens_chain ON public.fun_tokens(chain);
```

---

## Phase 4: Base Launch UI

### Launch Form for Base
Similar to Solana but with EVM-specific:
- ETH amount for initial liquidity (not SOL)
- Gas estimation display
- Network fee display in ETH
- MetaMask/WalletConnect signing

### Launch Modes for Base
| Mode | Availability |
|------|--------------|
| Custom | ✅ Full control, manual image upload |
| Describe (AI) | ✅ Generate via prompt |
| Phantom | ❌ Solana-only |
| Holders | 🔧 Later (needs EVM distribution) |

---

## Phase 5: Ethereum & BNB Chain

### Ethereum
- Same as Base but mainnet
- Higher gas costs → show estimates prominently
- Uniswap V3 integration

### BNB Chain
- PancakeSwap V3 for AMM
- Lower gas costs
- BNB as native currency

---

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | 2-3 days | Chain switcher UI, routes, context |
| **Phase 2** | 3-4 days | EVM wallet integration (wagmi) |
| **Phase 3** | 5-7 days | Base contracts, backend, deployment |
| **Phase 4** | 2-3 days | Base launch form UI |
| **Phase 5** | 3-5 days | Ethereum + BNB (reuse Base logic) |

**Total: ~3 weeks**

---

## Technical Considerations

### RPC Endpoints Needed
```env
# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453

# Ethereum
ETH_RPC_URL=https://eth.llamarpc.com
ETH_CHAIN_ID=1

# BNB
BNB_RPC_URL=https://bsc-dataseed.binance.org
BNB_CHAIN_ID=56
```

### Contract Deployment Approach
Option A: **Deploy per-token** (simpler, more expensive)
- Each token launch deploys new ERC20
- Higher gas but simpler

Option B: **Factory pattern** (recommended)
- Deploy TunaTokenFactory once
- Users call factory to create tokens
- Lower per-token gas cost

### LP Creation
| Chain | AMM | SDK |
|-------|-----|-----|
| Base | Uniswap V3 | @uniswap/v3-sdk |
| Ethereum | Uniswap V3 | @uniswap/v3-sdk |
| BNB | PancakeSwap V3 | @pancakeswap/v3-sdk |

---

## Security Considerations

1. **Contract Audits**: Factory contracts need audit before mainnet
2. **Private Key Management**: Server-side signing for factory (like Solana treasury)
3. **Rate Limiting**: IP-based limits per chain
4. **Front-running Protection**: Consider commit-reveal for launches

---

## Next Immediate Steps

1. ✅ Add chain switcher to header (visual only)
2. ✅ Create route structure for /launch/:chain
3. ⏳ Add wagmi + RainbowKit for EVM wallets
4. ⏳ Create Base launch form (UI)
5. ⏳ Develop/deploy Base token factory contract
6. ⏳ Backend integration for Base launches
