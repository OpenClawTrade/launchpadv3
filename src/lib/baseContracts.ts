// Contract ABIs for Base chain Flaunch replica - Uniswap V4 based architecture
// Full Flaunch.gg replica with V4 hooks, flETH yield wrapper, and Progressive BidWall

// ============ TunaPositionManager (V4 Hook) ============
export const TUNA_POSITION_MANAGER_ABI = [
  // Read functions
  {
    name: 'nativeToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'flaunchContract',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'bidWall',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'fairLaunch',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'creatorFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'uint24' }],
  },
  {
    name: 'flaunchesAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'poolKey',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'memecoin', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
    ],
  },
  {
    name: 'getFlaunchingFee',
    type: 'function',
    stateMutability: 'pure',
    inputs: [{ name: 'initialPriceParams', type: 'bytes' }],
    outputs: [{ type: 'uint256' }],
  },
  // Write functions
  {
    name: 'flaunch',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'tokenUri', type: 'string' },
          { name: 'initialTokenFairLaunch', type: 'uint256' },
          { name: 'fairLaunchDuration', type: 'uint256' },
          { name: 'premineAmount', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'creatorFeeAllocation', type: 'uint24' },
          { name: 'flaunchAt', type: 'uint256' },
          { name: 'initialPriceParams', type: 'bytes' },
          { name: 'feeCalculatorParams', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'memecoin', type: 'address' }],
  },
  // Events
  {
    name: 'PoolCreated',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'memecoin', type: 'address', indexed: false },
      { name: 'treasury', type: 'address', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'currencyFlipped', type: 'bool', indexed: false },
      { name: 'flaunchFee', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PoolScheduled',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'flaunchesAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PoolSwap',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'flAmount0', type: 'int256', indexed: false },
      { name: 'flAmount1', type: 'int256', indexed: false },
      { name: 'flFee0', type: 'int256', indexed: false },
      { name: 'flFee1', type: 'int256', indexed: false },
      { name: 'bidWallAmount0', type: 'int256', indexed: false },
      { name: 'bidWallAmount1', type: 'int256', indexed: false },
      { name: 'uniFee0', type: 'int256', indexed: false },
      { name: 'uniFee1', type: 'int256', indexed: false },
    ],
  },
] as const;

// ============ TunaFlaunch (ERC721 NFT) ============
export const TUNA_FLAUNCH_ABI = [
  // ERC721 standard
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // Custom functions
  {
    name: 'nextTokenId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'memecoin',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'tokenIdByMemecoin',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'memecoin', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'positionManager',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // Events
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const;

// ============ TunaBidWall ============
export const TUNA_BID_WALL_ABI = [
  // Read functions
  {
    name: 'isBidWallEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'poolInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'disabled', type: 'bool' },
          { name: 'initialized', type: 'bool' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'pendingETHFees', type: 'uint256' },
          { name: 'cumulativeSwapFees', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'lastPoolTransaction',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'staleTimeWindow',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getSwapFeeThreshold',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'BidWallDeposit',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'added', type: 'uint256', indexed: false },
      { name: 'pending', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BidWallRepositioned',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'eth', type: 'uint256', indexed: false },
      { name: 'tickLower', type: 'int24', indexed: false },
      { name: 'tickUpper', type: 'int24', indexed: false },
    ],
  },
] as const;

// ============ TunaFairLaunch ============
export const TUNA_FAIR_LAUNCH_ABI = [
  {
    name: 'inFairLaunchWindow',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'fairLaunchInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'startsAt', type: 'uint256' },
          { name: 'endsAt', type: 'uint256' },
          { name: 'initialTick', type: 'int24' },
          { name: 'revenue', type: 'uint256' },
          { name: 'supply', type: 'uint256' },
          { name: 'closed', type: 'bool' },
        ],
      },
    ],
  },
  // Events
  {
    name: 'FairLaunchCreated',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'tokens', type: 'uint256', indexed: false },
      { name: 'startsAt', type: 'uint256', indexed: false },
      { name: 'endsAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'FairLaunchEnded',
    type: 'event',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true },
      { name: 'revenue', type: 'uint256', indexed: false },
      { name: 'unsoldSupply', type: 'uint256', indexed: false },
      { name: 'endedAt', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ============ TunaFlETH (Yield Wrapper) ============
export const TUNA_FLETH_ABI = [
  // ERC20 standard
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // Custom functions
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [{ name: 'flethAmount', type: 'uint256' }],
  },
  {
    name: 'depositFor',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [{ name: 'flethAmount', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'flethAmount', type: 'uint256' }],
    outputs: [{ name: 'ethAmount', type: 'uint256' }],
  },
  {
    name: 'harvestYield',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'yieldAmount', type: 'uint256' }],
  },
  {
    name: 'getCurrentAPY',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getTotalValueLocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getPendingYield',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalDeposited',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'treasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'yieldStrategy',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  // Events
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'ethAmount', type: 'uint256', indexed: false },
      { name: 'flethMinted', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdraw',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'flethBurned', type: 'uint256', indexed: false },
      { name: 'ethReturned', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'YieldHarvested',
    type: 'event',
    inputs: [
      { name: 'yieldAmount', type: 'uint256', indexed: false },
      { name: 'recipient', type: 'address', indexed: false },
    ],
  },
] as const;

// ============ Contract Addresses on Base ============
// Update these after deployment
export const BASE_FLAUNCH_CONTRACTS = {
  // Core contracts (to be deployed)
  POSITION_MANAGER: '0x0000000000000000000000000000000000000000',
  FLAUNCH_NFT: '0x0000000000000000000000000000000000000000',
  BID_WALL: '0x0000000000000000000000000000000000000000',
  FAIR_LAUNCH: '0x0000000000000000000000000000000000000000',
  FLETH: '0x0000000000000000000000000000000000000000',
  
  // Official Flaunch addresses (for reference - on Base Mainnet)
  FLAUNCH_OFFICIAL: {
    FEE_EXEMPTIONS: '0xfdCE459071c74b732B2dEC579Afb38Ea552C4e06',
    POSITION_MANAGER: '0x51Bba15255406Cfe7099a42183302640ba7dAFDC',
    BID_WALL: '0x66681f10BA90496241A25e33380004f30Dfd8aa8',
    FAIR_LAUNCH: '0xCc7A4A00072ccbeEEbd999edc812C0ce498Fb63B',
    FLAUNCH_NFT: '0x6A53F8b799bE11a2A3264eF0bfF183dCB12d9571',
    FLETH: '0x000000000d564d5be76f7f0d28fe52605afc7cf8',
    POOL_SWAP: '0x4c211268cbf275637A8C235E63A26BC0E05ACA25',
  },
} as const;

// ============ Uniswap V4 Addresses on Base ============
export const BASE_UNISWAP_V4 = {
  POOL_MANAGER: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  POSITION_MANAGER: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
  QUOTER: '0x0d5e0F971ED27FBfF6c2837bf31316121532048D',
  STATE_VIEW: '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
  UNIVERSAL_ROUTER: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
} as const;

// ============ Standard Base Addresses ============
export const BASE_ADDRESSES = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  AAVE_V3_POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
} as const;

// ============ Legacy V3 ABI (deprecated, use V4 above) ============
export const TUNA_LAUNCHPAD_ABI = TUNA_POSITION_MANAGER_ABI;
export const BASE_CONTRACTS = BASE_FLAUNCH_CONTRACTS;
