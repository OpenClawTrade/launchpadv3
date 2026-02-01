// Contract ABIs for Base chain integration - Consolidated TunaLaunchpad
// All functionality in single contract for simpler deployment

export const TUNA_LAUNCHPAD_ABI = [
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
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'imageUrl', type: 'string' },
          { name: 'creatorFeeBps', type: 'uint256' },
          { name: 'fairLaunchEnd', type: 'uint256' },
          { name: 'totalFeesEarned', type: 'uint256' },
          { name: 'creatorFeesPending', type: 'uint256' },
          { name: 'buybackPool', type: 'uint256' },
          { name: 'lpTokenId', type: 'uint256' },
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
    name: 'getBuybackPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getFairLaunchAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'wallet', type: 'address' },
    ],
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
      { name: 'imageUrl', type: 'string' },
      { name: 'creatorFeeBps', type: 'uint256' },
      { name: 'fairLaunchMins', type: 'uint256' },
      { name: 'maxBuyEth', type: 'uint256' },
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
    name: 'claimCreatorFees',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'executeBuyback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
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
    ],
  },
  {
    name: 'PoolCreated',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'poolAddress', type: 'address', indexed: true },
      { name: 'lpTokenId', type: 'uint256', indexed: false },
      { name: 'initialEth', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'CreatorFeesClaimed',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BuybackExecuted',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'ethSpent', type: 'uint256', indexed: false },
      { name: 'tokensBought', type: 'uint256', indexed: false },
      { name: 'tokensBurned', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Contract addresses on Base (to be updated after deployment)
export const BASE_CONTRACTS = {
  // Single consolidated contract
  TUNA_LAUNCHPAD: '0x0000000000000000000000000000000000000000', // Deploy and update
} as const;

// Standard addresses on Base mainnet
export const BASE_ADDRESSES = {
  WETH: '0x4200000000000000000000000000000000000006',
  UNISWAP_V3_FACTORY: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  UNISWAP_V3_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',
  UNISWAP_POSITION_MANAGER: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
} as const;
