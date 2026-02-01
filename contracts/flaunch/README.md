# Tuna Flaunch - Full Flaunch.gg Replica

This directory contains the complete Flaunch.gg architecture replica for Base chain.

## Architecture Overview

This is a **1:1 replica** of Flaunch.gg's contract architecture, implementing Uniswap V4 hooks for trading fee management and yield-bearing ETH wrappers for platform revenue.

### Core Contracts

| Contract | Description |
|----------|-------------|
| `TunaPositionManager.sol` | Uniswap V4 Hook - manages full token lifecycle (flaunch → fair launch → trading) |
| `TunaFlaunch.sol` | ERC721 NFT representing fee stream ownership |
| `TunaBidWall.sol` | Progressive Bid Wall - single-sided liquidity 1 tick below spot |
| `TunaFairLaunch.sol` | Fixed-price fair launch period logic |
| `TunaFlETH.sol` | Yield-bearing ETH wrapper (Aave integration for platform revenue) |
| `TunaMemecoin.sol` | Standard ERC20 memecoin |

### Interfaces

| Interface | Description |
|-----------|-------------|
| `IPositionManager.sol` | Position manager interface with FlaunchParams |
| `ITunaFlaunch.sol` | Flaunch NFT interface |
| `ITunaMemecoin.sol` | Memecoin interface |
| `ITunaFlETH.sol` | Yield wrapper interface |

## How It Works

### Token Launch Flow

1. **Creator calls `flaunch()`** on PositionManager with:
   - Token name, symbol, image
   - Creator fee allocation (0-100% of trading fees)
   - Fair launch duration (5-30 minutes recommended)
   - Initial price parameters

2. **NFT is minted** to creator representing ownership of:
   - Fee stream (creator portion of 1% trading fee)
   - Ability to manage token treasury

3. **Fair Launch Period** begins:
   - Fixed price (single tick position)
   - Only buying allowed (no selling)
   - All ETH raised goes to BidWall for price support

4. **After Fair Launch**:
   - Remaining tokens + ETH form Uniswap V4 liquidity
   - Unsold tokens are burned
   - Normal trading begins with 1% fee

### Fee Distribution

Every trade incurs a **1% trading fee** split as follows:

```
Creator Fee Allocation: X% (set by creator, 0-100%)
BidWall Allocation: (100% - X%)
```

- **Creator Share**: Converted to flETH and sent to treasury
- **BidWall Share**: Deposited as single-sided liquidity 1 tick below spot

### Progressive Bid Wall

The BidWall provides "plunge protection":

1. Accumulates ETH from trading fees
2. Places liquidity at exactly 1 tick below current spot price
3. Automatically repositions after each deposit
4. Acts as automatic buyback when price drops
5. Tokens received are sent to treasury

### Platform Revenue (flETH)

Unlike traditional launchpads that take trading fees, Flaunch earns through **yield on locked liquidity**:

1. All pools trade against flETH (not raw ETH)
2. flETH wraps ETH and deposits into Aave V3
3. Platform earns ~3-5% APY on all locked liquidity
4. Users can always redeem flETH 1:1 for ETH

This means **zero platform trading fees** - creator gets full control of their fee allocation.

## Deployment

### Prerequisites

- Foundry installed
- Base RPC URL
- Deployer private key with ETH for gas

### Deploy Order

1. Deploy `TunaFlETH` (yield wrapper)
2. Deploy `TunaFlaunch` (NFT contract)
3. Deploy `TunaBidWall`
4. Deploy `TunaFairLaunch`
5. Deploy `TunaPositionManager` (V4 hook)
6. Initialize all contracts with cross-references

### Verification

```bash
forge verify-contract --chain base <ADDRESS> <CONTRACT>
```

## Comparison with Original Flaunch

| Feature | Flaunch.gg | Tuna Flaunch |
|---------|------------|--------------|
| DEX | Uniswap V4 | Uniswap V4 |
| Fee Collection | V4 Hooks | V4 Hooks |
| Trading Fee | 1% | 1% |
| Creator Fee | 0-100% | 0-100% |
| BidWall | Progressive | Progressive |
| Fair Launch | Fixed price | Fixed price |
| Platform Revenue | flETH yield | flETH yield |
| NFT Ownership | ERC721 | ERC721 |

## Security Considerations

1. **Reentrancy**: All external calls use ReentrancyGuard
2. **Access Control**: Role-based access for admin functions
3. **Price Manipulation**: BidWall uses beforeSwap tick to prevent manipulation
4. **Yield Strategy**: Can be paused/changed by admin if compromised

## License

MIT
