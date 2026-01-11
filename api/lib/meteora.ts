// TRENCHES Launchpad - Meteora SDK Integration
// Full on-chain integration with Meteora Dynamic Bonding Curve

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  deriveDammV1MigrationMetadataAddress,
  deriveBaseKeyForLocker,
  deriveEscrow,
  DAMM_V1_MIGRATION_FEE_ADDRESS,
  prepareSwapAmountParam,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { BN } from 'bn.js';
import {
  PLATFORM_FEE_WALLET,
  TOKEN_DECIMALS,
  TOTAL_SUPPLY,
  GRADUATION_THRESHOLD_SOL,
  TRADING_FEE_BPS,
  CREATOR_FEE_SHARE,
  PARTNER_LP_PERCENTAGE,
  CREATOR_LP_PERCENTAGE,
  PARTNER_LOCKED_LP_PERCENTAGE,
  CREATOR_LOCKED_LP_PERCENTAGE,
  MIGRATED_POOL_FEE_BPS,
  WSOL_MINT,
} from './config.js';
import { getConnection, getTreasuryKeypair } from './solana.js';

// Meteora client singleton
let meteoraClient: DynamicBondingCurveClient | null = null;

export function getMeteoraClient(): DynamicBondingCurveClient {
  if (!meteoraClient) {
    const connection = getConnection();
    meteoraClient = new DynamicBondingCurveClient(connection, 'confirmed');
  }
  return meteoraClient;
}

// Calculate sqrt price from virtual reserves
// Formula: sqrtPrice = sqrt(virtualSol / virtualToken) * 2^64
export function calculateSqrtStartPrice(virtualSol: number, virtualToken: number): InstanceType<typeof BN> {
  const price = virtualSol / virtualToken;
  const sqrtPrice = Math.sqrt(price);
  // Scale by 2^64 for Meteora's fixed-point representation
  const scaled = sqrtPrice * Math.pow(2, 64);
  return new BN(Math.floor(scaled).toString());
}

// Calculate bonding curve points for Meteora
// This creates a curve that graduates at GRADUATION_THRESHOLD_SOL
export function calculateBondingCurve(): Array<{ sqrtPrice: InstanceType<typeof BN>; liquidity: InstanceType<typeof BN> }> {
  // Start price (at launch)
  const startSqrtPrice = calculateSqrtStartPrice(30, TOTAL_SUPPLY);
  
  // End price (at graduation - 85 SOL)
  const endSqrtPrice = calculateSqrtStartPrice(85, TOTAL_SUPPLY * 0.2); // ~20% remaining
  
  // Maximum price (theoretical max)
  const maxSqrtPrice = new BN('79226673521066979257578248091');
  
  // Calculate liquidity to achieve graduation at threshold
  const startLiquidity = new BN(TOTAL_SUPPLY.toString())
    .mul(new BN(10).pow(new BN(TOKEN_DECIMALS)))
    .mul(startSqrtPrice)
    .div(new BN(10).pow(new BN(18)));
  
  return [
    {
      sqrtPrice: endSqrtPrice,
      liquidity: startLiquidity,
    },
    {
      sqrtPrice: maxSqrtPrice,
      liquidity: new BN('1'),
    },
  ];
}

// Pool creation parameters
export interface CreatePoolParams {
  creatorWallet: string;
  name: string;
  ticker: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  initialBuySol?: number;
}

// Create a new token pool on Meteora
export async function createMeteoraPool(params: CreatePoolParams): Promise<{
  transactions: Transaction[];
  mintKeypair: Keypair;
  configKeypair: Keypair;
  poolAddress: PublicKey;
}> {
  const client = getMeteoraClient();
  const connection = getConnection();
  
  // Generate keypairs for the new token
  const mintKeypair = Keypair.generate();
  const configKeypair = Keypair.generate();
  
  const creatorPubkey = new PublicKey(params.creatorWallet);
  const platformPubkey = new PublicKey(PLATFORM_FEE_WALLET);
  
  // Calculate fee numerator (2% = 200 bps = 2,000,000 / 100,000,000)
  const feeNumerator = new BN(TRADING_FEE_BPS * 10000); // 2% = 2000000
  
  // Prepare initial buy if specified
  let firstBuyParam = null;
  if (params.initialBuySol && params.initialBuySol > 0) {
    const amountIn = await prepareSwapAmountParam(
      params.initialBuySol,
      new PublicKey(WSOL_MINT),
      connection
    );
    firstBuyParam = {
      buyer: creatorPubkey,
      buyAmount: amountIn,
      minimumAmountOut: new BN(1),
      referralTokenAccount: null,
    };
  }

  // Build token metadata URI
  const metadataUri = params.imageUrl || `https://trenches.app/api/metadata/${mintKeypair.publicKey.toBase58()}`;

  // Derive pool address
  const { deriveDbcPoolAddress } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const poolAddress = deriveDbcPoolAddress(
    new PublicKey(WSOL_MINT),
    mintKeypair.publicKey,
    configKeypair.publicKey
  );

  // Create pool with config
  const { createConfigTx, createPoolTx, swapBuyTx } = await client.pool.createConfigAndPoolWithFirstBuy({
    payer: creatorPubkey,
    config: configKeypair.publicKey,
    feeClaimer: platformPubkey, // Platform receives fees, distributes via our system
    leftoverReceiver: platformPubkey, // Leftover tokens go to platform
    quoteMint: new PublicKey(WSOL_MINT),
    
    // Fee configuration - 2% total
    poolFees: {
      baseFee: {
        cliffFeeNumerator: feeNumerator,
        firstFactor: 0,
        secondFactor: new BN('0'),
        thirdFactor: new BN('0'),
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      },
      dynamicFee: {
        binStep: 1,
        binStepU128: new BN('1844674407370955'),
        filterPeriod: 10,
        decayPeriod: 120,
        reductionFactor: 1000,
        variableFeeControl: 100000,
        maxVolatilityAccumulator: 100000,
      },
    },
    
    // Activation - immediate
    activationType: 0,
    collectFeeMode: 0,
    
    // Migration settings - to DAMM V2 on graduation
    migrationOption: 1, // Migrate to DAMM V2
    
    // Token settings
    tokenType: 0, // SPL Token (not Token-2022)
    tokenDecimal: TOKEN_DECIMALS,
    
    // Graduation threshold - 85 SOL in lamports
    migrationQuoteThreshold: new BN(GRADUATION_THRESHOLD_SOL * 1e9),
    
    // LP distribution on graduation
    // 100% locked to platform (no unlocked LP)
    partnerLpPercentage: PARTNER_LP_PERCENTAGE,
    creatorLpPercentage: CREATOR_LP_PERCENTAGE,
    partnerLockedLpPercentage: PARTNER_LOCKED_LP_PERCENTAGE,
    creatorLockedLpPercentage: CREATOR_LOCKED_LP_PERCENTAGE,
    
    // Starting price
    sqrtStartPrice: calculateSqrtStartPrice(30, TOTAL_SUPPLY),
    
    // No vesting
    lockedVesting: {
      amountPerPeriod: new BN('0'),
      cliffDurationFromMigrationTime: new BN('0'),
      frequency: new BN('0'),
      numberOfPeriod: new BN('0'),
      cliffUnlockAmount: new BN('0'),
    },
    
    // Migration fee option
    migrationFeeOption: 2,
    
    // Token supply
    tokenSupply: {
      preMigrationTokenSupply: new BN(TOTAL_SUPPLY).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))),
      postMigrationTokenSupply: new BN(TOTAL_SUPPLY).mul(new BN(10).pow(new BN(TOKEN_DECIMALS))),
    },
    
    // Creator trading fee percentage - 0% means 100% goes to feeClaimer (treasury)
    creatorTradingFeePercentage: 0, // 0% to creator, 100% to treasury
    
    // Immutable metadata
    tokenUpdateAuthority: 1,
    
    // Migration fees
    migrationFee: {
      feePercentage: 0,
      creatorFeePercentage: 0,
    },
    
    // Post-migration pool fees
    migratedPoolFee: {
      collectFeeMode: CollectFeeMode.QuoteToken,
      dynamicFee: DammV2DynamicFeeMode.Disabled,
      poolFeeBps: MIGRATED_POOL_FEE_BPS,
    },
    
    padding: [],
    
    // Bonding curve shape
    curve: calculateBondingCurve(),
    
    // Token metadata
    preCreatePoolParam: {
      baseMint: mintKeypair.publicKey,
      name: params.name,
      symbol: params.ticker.toUpperCase(),
      uri: metadataUri,
      poolCreator: creatorPubkey,
    },
    
    // Initial buy (if any)
    firstBuyParam,
  });

  // Collect transactions
  const transactions: Transaction[] = [createConfigTx, createPoolTx];
  if (swapBuyTx) {
    transactions.push(swapBuyTx);
  }

  return {
    transactions,
    mintKeypair,
    configKeypair,
    poolAddress,
  };
}

// Execute a swap on the bonding curve
export async function executeMeteoraSwap(params: {
  poolAddress: string;
  userWallet: string;
  amount: number;
  isBuy: boolean;
  slippageBps?: number;
}): Promise<{
  transaction: Transaction | VersionedTransaction;
  estimatedOutput: number;
}> {
  const client = getMeteoraClient();
  const connection = getConnection();
  
  const poolPubkey = new PublicKey(params.poolAddress);
  const userPubkey = new PublicKey(params.userWallet);
  const slippage = params.slippageBps || 500; // 5% default
  
  // Get pool state
  const poolState = await client.state.getPool(poolPubkey);
  if (!poolState) {
    throw new Error('Pool not found');
  }
  
  if (poolState.isMigrated) {
    throw new Error('Pool has graduated. Trade on DEX.');
  }
  
  // Get pool config
  const poolConfig = await client.state.getPoolConfig(poolState.config);
  if (!poolConfig) {
    throw new Error('Pool config not found');
  }
  
  let transaction: Transaction;
  let estimatedOutput: number;
  
  if (params.isBuy) {
    // Buy: SOL -> Token (swapBaseForQuote = false, we're swapping quote for base)
    const amountInLamports = new BN(Math.floor(params.amount * 1e9));
    
    // Get quote using the correct parameters
    // Use activationPoint from pool config
    const currentPoint = poolState.activationPoint || new BN(0);
    const quote = client.pool.swapQuote({
      virtualPool: poolState,
      config: poolConfig,
      swapBaseForQuote: false, // Buying token with SOL
      amountIn: amountInLamports,
      slippageBps: slippage,
      hasReferral: false,
      currentPoint,
    });
    
    estimatedOutput = Number(quote.outputAmount.toString()) / Math.pow(10, TOKEN_DECIMALS);
    
    // Build swap transaction
    transaction = await client.pool.swap({
      owner: userPubkey,
      pool: poolPubkey,
      amountIn: amountInLamports,
      minimumAmountOut: quote.minimumAmountOut,
      swapBaseForQuote: false,
      referralTokenAccount: null,
    });
    
  } else {
    // Sell: Token -> SOL (swapBaseForQuote = true)
    const amountIn = new BN(Math.floor(params.amount * Math.pow(10, TOKEN_DECIMALS)));
    
    // Get quote
    const currentPoint = poolState.activationPoint || new BN(0);
    const quote = client.pool.swapQuote({
      virtualPool: poolState,
      config: poolConfig,
      swapBaseForQuote: true, // Selling token for SOL
      amountIn: amountIn,
      slippageBps: slippage,
      hasReferral: false,
      currentPoint,
    });
    
    estimatedOutput = Number(quote.outputAmount.toString()) / 1e9; // Convert lamports to SOL
    
    // Build swap transaction
    transaction = await client.pool.swap({
      owner: userPubkey,
      pool: poolPubkey,
      amountIn: amountIn,
      minimumAmountOut: quote.minimumAmountOut,
      swapBaseForQuote: true,
      referralTokenAccount: null,
    });
  }
  
  return {
    transaction,
    estimatedOutput,
  };
}

// Get pool state from Meteora
export async function getPoolState(poolAddress: string) {
  const client = getMeteoraClient();
  const poolPubkey = new PublicKey(poolAddress);
  
  const poolState = await client.state.getPool(poolPubkey);
  if (!poolState) {
    return null;
  }
  
  // Calculate current price
  const virtualSol = Number(poolState.quoteReserve.toString()) / 1e9;
  const virtualToken = Number(poolState.baseReserve.toString()) / Math.pow(10, TOKEN_DECIMALS);
  const price = virtualSol / virtualToken;
  
  return {
    mintAddress: poolState.baseMint.toBase58(),
    poolAddress: poolPubkey.toBase58(),
    virtualSolReserves: virtualSol,
    virtualTokenReserves: virtualToken,
    price,
    isMigrated: poolState.isMigrated,
    totalSupply: TOTAL_SUPPLY,
    marketCap: price * TOTAL_SUPPLY,
  };
}

// Handle pool graduation (migration to DAMM V2)
export async function migratePool(poolAddress: string): Promise<string[]> {
  const client = getMeteoraClient();
  const connection = getConnection();
  const treasury = getTreasuryKeypair();
  
  const poolPubkey = new PublicKey(poolAddress);
  const poolState = await client.state.getPool(poolPubkey);
  
  if (!poolState) {
    throw new Error('Pool not found');
  }
  
  if (poolState.isMigrated) {
    throw new Error('Pool already migrated');
  }
  
  const config = poolState.config;
  const poolConfig = await client.state.getPoolConfig(config);
  
  const signatures: string[] = [];
  
  // Step 1: Create migration metadata
  const migrationMetadata = deriveDammV1MigrationMetadataAddress(poolPubkey);
  const metadataAccount = await connection.getAccountInfo(migrationMetadata);
  
  if (!metadataAccount) {
    const createMetadataTx = await client.migration.createDammV1MigrationMetadata({
      payer: treasury.publicKey,
      virtualPool: poolPubkey,
      config: config,
    });
    
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    createMetadataTx.recentBlockhash = blockhash;
    createMetadataTx.feePayer = treasury.publicKey;
    
    const sig = await connection.sendTransaction(createMetadataTx, [treasury]);
    await connection.confirmTransaction(sig, 'confirmed');
    signatures.push(sig);
  }
  
  // Step 2: Create locker if needed
  if (
    poolConfig.lockedVestingConfig.amountPerPeriod.gt(new BN(0)) ||
    poolConfig.lockedVestingConfig.cliffUnlockAmount.gt(new BN(0))
  ) {
    const base = deriveBaseKeyForLocker(poolPubkey);
    const escrow = deriveEscrow(base);
    const escrowAccount = await connection.getAccountInfo(escrow);
    
    if (!escrowAccount) {
      const createLockerTx = await client.migration.createLocker({
        virtualPool: poolPubkey,
        payer: treasury.publicKey,
      });
      
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      createLockerTx.recentBlockhash = blockhash;
      createLockerTx.feePayer = treasury.publicKey;
      
      const sig = await connection.sendTransaction(createLockerTx, [treasury]);
      await connection.confirmTransaction(sig, 'confirmed');
      signatures.push(sig);
    }
  }
  
  // Step 3: Migrate to DAMM V1/V2
  const migrateTx = await client.migration.migrateToDammV1({
    payer: treasury.publicKey,
    virtualPool: poolPubkey,
    dammConfig: DAMM_V1_MIGRATION_FEE_ADDRESS[poolConfig.migrationFeeOption],
  });
  
  const { blockhash: migrateBlockhash } = await connection.getLatestBlockhash('confirmed');
  migrateTx.recentBlockhash = migrateBlockhash;
  migrateTx.feePayer = treasury.publicKey;
  
  const migrateSig = await connection.sendTransaction(migrateTx, [treasury]);
  await connection.confirmTransaction(migrateSig, 'confirmed');
  signatures.push(migrateSig);
  
  // Step 4: Lock LP tokens for platform
  if (poolConfig.partnerLockedLpPercentage > 0) {
    const lockTx = await client.migration.lockDammV1LpToken({
      payer: treasury.publicKey,
      virtualPool: poolPubkey,
      dammConfig: DAMM_V1_MIGRATION_FEE_ADDRESS[poolConfig.migrationFeeOption],
      isPartner: true,
    });
    
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    lockTx.recentBlockhash = blockhash;
    lockTx.feePayer = treasury.publicKey;
    
    const sig = await connection.sendTransaction(lockTx, [treasury]);
    await connection.confirmTransaction(sig, 'confirmed');
    signatures.push(sig);
  }
  
  return signatures;
}

// Claim partner trading fees from DBC pool (pre-graduation)
// Only the feeClaimer (treasury) can call this
export async function claimPartnerFees(poolAddress: string): Promise<{
  signature: string;
  claimedSol: number;
}> {
  const client = getMeteoraClient();
  const connection = getConnection();
  const treasury = getTreasuryKeypair();
  
  const poolPubkey = new PublicKey(poolAddress);
  
  // Get pool fee metrics
  const feeMetrics = await client.state.getPoolFeeMetrics(poolPubkey);
  if (!feeMetrics) {
    throw new Error('Failed to get pool fee metrics');
  }
  
  const partnerQuoteFee = Number(feeMetrics.current.partnerQuoteFee.toString()) / 1e9;
  
  if (partnerQuoteFee < 0.001) {
    throw new Error('Insufficient fees to claim (minimum 0.001 SOL)');
  }
  
  // Build claim transaction
  const claimTx = await client.partner.claimPartnerTradingFee({
    payer: treasury.publicKey,
    feeClaimer: treasury.publicKey,
    pool: poolPubkey,
    maxBaseAmount: new BN('18446744073709551615'), // Max uint64
    maxQuoteAmount: new BN('18446744073709551615'), // Max uint64
  });
  
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  claimTx.recentBlockhash = blockhash;
  claimTx.feePayer = treasury.publicKey;
  
  const signature = await connection.sendTransaction(claimTx, [treasury]);
  await connection.confirmTransaction(signature, 'confirmed');
  
  return {
    signature,
    claimedSol: partnerQuoteFee,
  };
}

// Get claimable fees from DBC pool
export async function getClaimableFees(poolAddress: string): Promise<{
  partnerQuoteFee: number;
  partnerBaseFee: number;
  totalTradingFee: number;
}> {
  const client = getMeteoraClient();
  const poolPubkey = new PublicKey(poolAddress);
  
  const feeMetrics = await client.state.getPoolFeeMetrics(poolPubkey);
  if (!feeMetrics) {
    throw new Error('Failed to get pool fee metrics');
  }
  
  return {
    partnerQuoteFee: Number(feeMetrics.current.partnerQuoteFee.toString()) / 1e9,
    partnerBaseFee: Number(feeMetrics.current.partnerBaseFee.toString()) / Math.pow(10, TOKEN_DECIMALS),
    totalTradingFee: (Number(feeMetrics.current.partnerQuoteFee.toString()) + Number(feeMetrics.current.creatorQuoteFee.toString())) / 1e9,
  };
}

// Serialize transaction for client signing
export function serializeTransaction(tx: Transaction | VersionedTransaction): string {
  if (tx instanceof VersionedTransaction) {
    return Buffer.from(tx.serialize()).toString('base64');
  }
  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');
}

// Get required signers from transaction
export function getRequiredSigners(
  mintKeypair: Keypair,
  configKeypair: Keypair
): { mint: string; config: string } {
  return {
    mint: Buffer.from(mintKeypair.secretKey).toString('base64'),
    config: Buffer.from(configKeypair.secretKey).toString('base64'),
  };
}
