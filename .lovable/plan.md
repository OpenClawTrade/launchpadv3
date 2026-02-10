
# Real Base Launchpad: On-Chain ERC20 Deployment

## Problem

Nothing is actually deployed on-chain right now. The current flow:
1. `base-deploy-contracts` just writes "edge-function-factory" to the DB (no real contract)
2. `base-create-token` just inserts a DB record with `0x000...` placeholder addresses
3. `BaseLauncher.tsx` passes placeholder addresses and never deploys a real token

The entire Base launchpad is a mockup -- no ERC20 tokens are created on-chain, no Uniswap pools exist, no trading is possible.

## Solution

Rewrite `base-create-token` to **deploy a real ERC20 token on Base mainnet** using `viem` and the `BASE_DEPLOYER_PRIVATE_KEY` secret (already configured). Then optionally create a Uniswap V3 pool for it.

## Architecture

The edge function `base-create-token` will do everything server-side using the platform deployer wallet:

```text
User clicks "Launch" in BaseLauncher
        |
        v
base-create-token edge function
        |
        +-- 1. Deploy ERC20 token contract (viem deployContract)
        |       - Standard OpenZeppelin ERC20
        |       - Constructor: name, symbol, deployer address, total supply
        |       - Mint all tokens to deployer wallet
        |
        +-- 2. Wait for deployment tx confirmation
        |
        +-- 3. (Optional) Create Uniswap V3 pool
        |       - Pair: TOKEN/WETH
        |       - Initialize with starting price
        |       - Add initial liquidity
        |
        +-- 4. Record real addresses in fun_tokens table
        |       - evm_token_address = real deployed contract
        |       - evm_pool_address = Uniswap pool (or empty)
        |       - evm_factory_tx_hash = real deployment tx hash
        |
        +-- 5. Return success with real addresses
```

## Detailed Changes

### 1. Rewrite `supabase/functions/base-create-token/index.ts`

The core change. This function will:

- Import `viem` (createWalletClient, createPublicClient, http, parseEther, etc.)
- Import `privateKeyToAccount` from viem/accounts
- Use `BASE_DEPLOYER_PRIVATE_KEY` to create the deployer account
- Deploy a **standard ERC20 contract** using inline Solidity ABI + bytecode
  - The bytecode will be for a minimal ERC20: `constructor(string name, string symbol, address mintTo, uint256 totalSupply)`
  - Total supply: 1,000,000,000 tokens (1B with 18 decimals)
  - All tokens minted to creator wallet
- Wait for transaction receipt (confirmation)
- Store the real `evm_token_address` and `evm_factory_tx_hash` in the `fun_tokens` table via the existing `backend_create_base_token` RPC
- Return real token address and tx hash to frontend

**Bytecode approach**: Use a well-known, minimal OpenZeppelin ERC20 compiled bytecode. This is a standard pattern -- the bytecode for a basic ERC20 with constructor args is ~3KB and stable. We'll use the exact same bytecode that was in the original deploy function but properly complete (not truncated).

Alternatively, we can use `viem`'s `deployContract` with inline ABI + bytecode from a verified source, keeping it simple with just: name, symbol, initial mint recipient, and supply.

### 2. Update `src/components/launchpad/BaseLauncher.tsx`

- Remove the placeholder `0x000...` addresses from the request body
- The edge function now handles everything -- frontend just sends: name, ticker, creatorWallet, description, imageUrl, etc.
- Display the real token address and tx hash on success
- Add a link to Basescan for the deployment transaction

### 3. Rewrite `supabase/functions/base-deploy-contracts/index.ts`

- Remove the "virtual factory" nonsense
- Make it a simple dry-run/balance check tool for the admin panel
- OR repurpose it to deploy a real TunaFactory registry contract (optional, lower priority)
- For MVP: just verify deployer balance and return ready status

### 4. Update `src/hooks/useBaseContractDeploy.ts`

- Adjust the types to match the simplified deploy response (no more TunaFactory/TunaToken addresses since we deploy per-token)

## What This Gives You

- **Real ERC20 tokens** deployed on Base mainnet when users click "Launch"
- **Real Basescan-verifiable** contract addresses and tx hashes
- **Real token balances** visible in wallets (MetaMask, etc.)
- Tokens show up on-chain and can be transferred
- Foundation for adding Uniswap V3 pool creation + trading in a follow-up

## What's NOT Included (Follow-up Work)

- Uniswap V3 pool creation (requires additional liquidity logic)
- Trading/swapping interface
- On-chain fee collection (requires a fee-enabled token or wrapper)
- These can be added incrementally once basic token deployment works

## Dependencies

- `BASE_DEPLOYER_PRIVATE_KEY` -- already configured as a secret
- Deployer wallet must have ETH on Base mainnet for gas (~0.001-0.003 ETH per token deploy)
- `viem` library (already used in the codebase via esm.sh imports)

## ERC20 Bytecode Strategy

Instead of using pre-compiled truncated bytecode (which caused the original error), we'll use one of two approaches:

**Option A (Preferred)**: Encode a minimal Solidity ERC20 using viem's `encodeDeployData` with a well-known ABI. The bytecode for a standard OpenZeppelin ERC20 is publicly available and verified on Etherscan -- we'll use the exact bytecode from a verified Base mainnet contract.

**Option B (Fallback)**: Use a factory pattern where we call Uniswap's token creation or use CREATE2 with known init code.

We'll go with Option A for reliability.
