// Contract ABIs for Base chain integration
// These are simplified ABIs for frontend interaction

export const TUNA_FACTORY_ABI = [
  // Read functions
  {
    name: 'tokenCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'launchFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'tokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'poolAddress', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'creatorFeeBps', type: 'uint256' },
      { name: 'fairLaunchEnd', type: 'uint256' },
      { name: 'fairLaunchPrice', type: 'uint256' },
      { name: 'totalFeesEarned', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'getTokenInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tokenAddress', type: 'address' },
          { name: 'poolAddress', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'creatorFeeBps', type: 'uint256' },
          { name: 'fairLaunchEnd', type: 'uint256' },
          { name: 'fairLaunchPrice', type: 'uint256' },
          { name: 'totalFeesEarned', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'isInFairLaunch',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getUnclaimedFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  // Write functions
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'imageUrl', type: 'string' },
      { name: 'creatorFeeBps', type: 'uint256' },
      { name: 'fairLaunchDuration', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claimFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'creatorFeeBps', type: 'uint256', indexed: false },
      { name: 'fairLaunchDuration', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PoolCreated',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'poolAddress', type: 'address', indexed: true },
      { name: 'initialLiquidity', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CreatorFeesClaimed',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const TUNA_FEE_VAULT_ABI = [
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getTotalClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const TUNA_BID_WALL_ABI = [
  {
    name: 'getAccumulatedEth',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getBuybackStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'accumulated', type: 'uint256' },
      { name: 'bought', type: 'uint256' },
      { name: 'burned', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
  },
  {
    name: 'canTriggerBuyback',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'triggerBuyback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
] as const;

// Contract addresses on Base (to be updated after deployment)
export const BASE_CONTRACTS = {
  FACTORY: '0x0000000000000000000000000000000000000000', // Deploy and update
  FEE_VAULT: '0x0000000000000000000000000000000000000000',
  BID_WALL: '0x0000000000000000000000000000000000000000',
  FAIR_LAUNCH: '0x0000000000000000000000000000000000000000',
  SWAP_HOOK: '0x0000000000000000000000000000000000000000',
} as const;

// Uniswap V3/V4 addresses on Base
export const BASE_UNISWAP = {
  V3_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',
  V4_POOL_MANAGER: '0x498581fF718922c3f8e6A244956aF099B2652b2b', // Same as Flaunch uses
  WETH: '0x4200000000000000000000000000000000000006',
} as const;
