# TUNA Base Contracts

Solidity smart contracts for the TUNA launchpad on Base chain, inspired by [Flaunch.gg](https://flaunch.gg).

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TunaFactory                               │
│  - Creates ERC20 tokens                                         │
│  - Mints NFTs representing fee stream ownership                 │
│  - Manages token lifecycle                                      │
├─────────────────────────────────────────────────────────────────┤
│                           │                                      │
│           ┌───────────────┼───────────────┐                      │
│           ▼               ▼               ▼                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │ TunaFeeVault │ │ TunaBidWall  │ │TunaFairLaunch│            │
│   │              │ │              │ │              │            │
│   │ Stores       │ │ Auto-buyback │ │ Fixed price  │            │
│   │ creator fees │ │ engine       │ │ period       │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│                           │                                      │
│                           ▼                                      │
│               ┌──────────────────────┐                          │
│               │    TunaSwapHook      │                          │
│               │                      │                          │
│               │ Uniswap V4 hook for  │                          │
│               │ fee collection       │                          │
│               └──────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Contracts

### TunaFactory.sol
Main factory contract that creates tokens and manages the lifecycle.

**Features:**
- Creates ERC20 tokens with fixed 1B supply
- Mints NFT representing ownership of fee stream (transferable like Flaunch)
- Configurable creator fee split (0-100%)
- Integrates with FeeVault, BidWall, and FairLaunch

### TunaToken.sol
Standard ERC20 token with burn capability.

**Features:**
- Fixed 1B supply with 18 decimals
- Burnable (for deflationary buybacks)
- Metadata storage (name, symbol, description, image, socials)

### TunaFeeVault.sol
Stores and distributes creator fees.

**Features:**
- Accumulates fees from trading
- Only NFT owner can claim
- Transferring NFT transfers fee rights

### TunaBidWall.sol
Progressive Bid Wall for automatic buybacks (like Flaunch).

**Features:**
- Accumulates community fee share
- Triggers buyback when threshold reached (0.05 ETH)
- Burns bought tokens (deflationary)

### TunaFairLaunch.sol
Fair launch mechanism with fixed price period.

**Features:**
- 5-30 minute fixed price period
- No sells during fair launch
- Per-wallet limits
- CAPTCHA verification support (anti-sniper)

### TunaSwapHook.sol
Uniswap V4 hook for fee collection.

**Features:**
- 1% trading fee (like Flaunch)
- Collects on every swap
- Routes to factory for distribution

## Fee Flow

```
                    1% Trading Fee (per swap)
                          │
          ┌───────────────┴───────────────┐
          │                               │
   Creator Share (0-100%)          Community Share
   (set at launch, immutable)      (remainder)
          │                               │
          ▼                               ▼
   ┌─────────────┐               ┌─────────────────┐
   │ TunaFeeVault│               │   TunaBidWall   │
   │ (claimable) │               │ (auto-buyback)  │
   └─────────────┘               └─────────────────┘
          │                               │
          ▼                               ▼
   Creator claims ETH            Tokens bought & burned
```

## Creator Earnings Example

For a token doing $100,000 daily volume with 1% fee and 80% creator share:
- Daily fees: $1,000
- Creator receives: $800/day
- Community buybacks: $200/day

## Key Differences from Flaunch

| Feature | Flaunch | TUNA Base |
|---------|---------|-----------|
| Trading Fee | 1% | 1% |
| Creator Share | 0-100% | 0-100% |
| Fee NFT | Yes | Yes |
| Fair Launch | 5-30 min | 5-30 min |
| BidWall | Yes | Yes |
| Platform Revenue | flETH yield | Launch fees |

## Deployment

### Prerequisites
- Node.js 18+
- Foundry or Hardhat
- Base mainnet RPC

### Deploy Order
1. Deploy TunaFeeVault
2. Deploy TunaBidWall
3. Deploy TunaFairLaunch
4. Deploy TunaFactory (with vault, bidwall, fairlaunch addresses)
5. Set factory address on vault, bidwall, fairlaunch
6. Deploy TunaSwapHook (with factory and pool manager)

### Environment Variables
```
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_deployer_key
PLATFORM_WALLET=your_platform_wallet
BASESCAN_API_KEY=your_basescan_key
```

## Security Considerations

- All contracts use OpenZeppelin's security libraries
- ReentrancyGuard on all external functions
- Ownable for admin functions
- Factory pattern for controlled token creation
- Fee NFT is transferable (like Flaunch royalty NFT)

## Gas Estimates (Base)

| Operation | Estimated Gas | Cost (~$2 ETH, 1 gwei) |
|-----------|---------------|------------------------|
| Create Token | ~200k | ~$0.40 |
| Create Pool | ~300k | ~$0.60 |
| Add Liquidity | ~200k | ~$0.40 |
| Claim Fees | ~50k | ~$0.10 |
| **Total Launch** | ~700k | **~$1.50** |

## License

MIT
