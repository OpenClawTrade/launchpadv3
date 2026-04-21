# PopShiba Ethereum Mainnet Contract Suite

Three contracts that power the PopShiba launchpad on Ethereum mainnet:

| Contract | Purpose | Deploy cost |
|---|---|---|
| `PopShibaToken.sol` | Clone-master ERC-20 implementation. Deployed ONCE. | ~250k gas |
| `PopShibaCloneFactory.sol` | EIP-1167 minimal-proxy factory. Clones the token impl on every launch (~25k gas vs 250k = **90% saving**). | ~400k gas |
| `PopShibaFeeVault.sol` | Holds Uniswap V3 LP NFTs. Auto-collects WETH fees, splits 50/50 (creator/platform), trustless on-chain `claim()`. | ~1.2M gas |

**Total one-time deploy cost:** ~$80–150 in gas at typical mainnet prices.

## Build & deploy

### 1. Compile (local — Foundry required)

```bash
cd contracts/popshiba
forge build
```

Artifacts land in `out/PopShibaToken.sol/PopShibaToken.json` etc.

### 2. Extract bytecode + ABI for the edge function

The deploy edge function (`supabase/functions/eth-deploy-contracts/`) needs precompiled artifacts because Deno cannot run `solc` reliably. Paste the compiled `bytecode.object` and `abi` from each Foundry artifact into:

```
supabase/functions/eth-deploy-contracts/artifacts/
  PopShibaToken.ts
  PopShibaCloneFactory.ts
  PopShibaFeeVault.ts
```

(The deploy edge function is not yet generated — it's blocked on these artifacts.)

### 3. Deploy via admin panel

1. Open `/treasury-admin` → **PopShiba Ethereum Contract Suite** card
2. Click **Check Deployer** — confirms `ETH_MAINNET_DEPLOYER_PRIVATE_KEY` wallet has ≥0.05 ETH
3. Click **Deploy to Mainnet** — runs all 3 deployments + auto-verifies on Etherscan
4. Addresses persist to `eth_deployments` table; `eth-create-token` will pick them up automatically

## Architecture

```
User clicks "Launch token"
        │
        ▼
  eth-create-token edge function
        │
        ├─ Reads active eth_deployments row → factory address
        ├─ factory.createToken(...) → 1 tx, ~25k gas
        ├─ Creates Uniswap V3 pool + mints LP NFT to vault
        ├─ vault.registerToken(token, lpId, creator)
        ▼
  Token live on-chain, fees auto-flow into vault
        │
        ├─ Periodic vault.collect(token) — anyone can call
        ├─ 50% WETH → creatorOwed[token]
        └─ 50% WETH → platformTreasury (auto-forwarded)

User clicks "Claim 0.0142 ETH" pill in nav
        ▼
  vault.claim(token, true) — unwraps WETH → sends ETH
```

## Security notes

- **Vault owner** = deployer wallet. Can `registerToken` and rotate `platformTreasury`. Cannot withdraw creator funds — that's enforced on-chain by `msg.sender == info.creator` in `claim()`.
- **Clone factory owner** = deployer wallet. Only the platform can mint clones (gas-paid by platform).
- **Token implementation** is a one-shot ERC-20: no owner, no mint, no blacklist, no pausable.
