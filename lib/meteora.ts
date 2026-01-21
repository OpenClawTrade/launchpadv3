// TRENCHES Launchpad - Meteora SDK Integration
// Full on-chain integration with Meteora Dynamic Bonding Curve
// 
// MIGRATION FIX HISTORY - See MIGRATION_FIX_HISTORY.md
// Using buildCurveWithMarketCap from SDK for terminal compatibility (Axiom/DEXTools/Birdeye)

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import {
  DynamicBondingCurveClient,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  ActivationType,
  MigrationOption,
  MigrationFeeOption,
  TokenType,
  deriveDammV1MigrationMetadataAddress,
  deriveBaseKeyForLocker,
  deriveEscrow,
  DAMM_V1_MIGRATION_FEE_ADDRESS,
  prepareSwapAmountParam,
  buildCurveWithMarketCap, // SDK curve builder for terminal compatibility
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
  WSOL_MINT,
  INITIAL_VIRTUAL_SOL,
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

// ============================================================================
// SDK Curve Builder - For Terminal Compatibility
// ============================================================================
// CRITICAL: Use buildCurveWithMarketCap from SDK instead of manual calculation
// This ensures curve encoding matches what Axiom/DEXTools/Birdeye expect
// See MIGRATION_FIX_HISTORY.md for failed manual attempts

/**
 * Build curve configuration using SDK's buildCurveWithMarketCap
 * This generates sqrtStartPrice, curve points, and migrationQuoteThreshold
 * that are compatible with external terminals for migration display
 */
export function buildCurveConfig() {
  const curveConfig = buildCurveWithMarketCap({
    // Market cap values (in SOL)
    initialMarketCap: INITIAL_VIRTUAL_SOL, // 30 SOL initial market cap
    migrationMarketCap: GRADUATION_THRESHOLD_SOL, // 85 SOL graduation threshold
    
    // Token configuration
    totalTokenSupply: TOTAL_SUPPLY, // 1 billion tokens
    tokenBaseDecimal: TOKEN_DECIMALS, // 6 decimals
    tokenQuoteDecimal: 9, // SOL has 9 decimals
    
    // Migration configuration
    migrationOption: MigrationOption.MET_DAMM_V2,
    activationType: ActivationType.Timestamp,
    collectFeeMode: CollectFeeMode.QuoteToken,
    migrationFeeOption: MigrationFeeOption.FixedBps200,
    tokenType: TokenType.SPL,
    
    // LP distribution
    partnerLpPercentage: PARTNER_LP_PERCENTAGE,
    creatorLpPercentage: CREATOR_LP_PERCENTAGE,
    partnerLockedLpPercentage: PARTNER_LOCKED_LP_PERCENTAGE,
    creatorLockedLpPercentage: CREATOR_LOCKED_LP_PERCENTAGE,
    
    // Fee configuration
    creatorTradingFeePercentage: 0, // 100% to platform treasury
    tokenUpdateAuthority: 1, // Immutable metadata
    leftover: 0, // No leftover tokens
    
    // Migration fees
    migrationFee: {
      feePercentage: 0,
      creatorFeePercentage: 0,
    },
    
    // No vesting
    lockedVestingParam: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    
    // Base fee configuration
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      feeSchedulerParam: {
        startingFeeBps: TRADING_FEE_BPS, // 200 bps = 2%
        endingFeeBps: TRADING_FEE_BPS,   // 200 bps = 2%
        numberOfPeriod: 0,
        totalDuration: 0, // No duration since fee is constant
      },
    },
    
    // Dynamic fee disabled for simplicity
    dynamicFeeEnabled: false,
  });
  
  console.log('[meteora] Built curve config via SDK buildCurveWithMarketCap');
  console.log('[meteora] sqrtStartPrice:', curveConfig.sqrtStartPrice?.toString());
  console.log('[meteora] migrationQuoteThreshold:', curveConfig.migrationQuoteThreshold?.toString());
  console.log('[meteora] curve points:', curveConfig.curve?.length);
  
  return curveConfig;
}

// ============================================================================
// DEPRECATED: Manual curve calculation (kept for reference)
// These functions are no longer used - SDK buildCurveWithMarketCap is preferred
// ============================================================================

// Calculate sqrt price from virtual reserves (DEPRECATED - use buildCurveConfig)
export function calculateSqrtStartPrice(virtualSol: number, virtualToken: number): InstanceType<typeof BN> {
  const price = virtualSol / virtualToken;
  const sqrtPrice = Math.sqrt(price);
  const scaled = sqrtPrice * Math.pow(2, 64);
  return new BN(Math.floor(scaled).toString());
}

// Calculate bonding curve points (DEPRECATED - use buildCurveConfig)
export function calculateBondingCurve(): Array<{ sqrtPrice: InstanceType<typeof BN>; liquidity: InstanceType<typeof BN> }> {
  console.warn('[meteora] WARNING: Using deprecated calculateBondingCurve - prefer buildCurveConfig()');
  return [
    {
      sqrtPrice: new BN('380289371323205464'),
      liquidity: new BN('101410499496546307411360885487802'),
    },
    {
      sqrtPrice: new BN('79226673521066979257578248091'),
      liquidity: new BN('3434578513360188981331421'),
    },
  ];
}

// Starting sqrt price (DEPRECATED - use buildCurveConfig)
export function getSqrtStartPrice(): InstanceType<typeof BN> {
  console.warn('[meteora] WARNING: Using deprecated getSqrtStartPrice - prefer buildCurveConfig()');
  return new BN('95072344172433750');
}

// Pool creation parameters
export interface CreatePoolParams {
  creatorWallet: string;
  // Optional override for the on-chain `leftoverReceiver`.
  // For FUN launches, the on-chain creator is the treasury (server-side signing),
  // but terminals (Axiom/DEXTools) often infer “project/owner” from leftoverReceiver.
  // Setting this to the user’s wallet helps migration/graduation UI display correctly.
  leftoverReceiverWallet?: string;
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
  lastValidBlockHeight: number;
}> {
  // Generate a random mint keypair
  const mintKeypair = Keypair.generate();
  return createMeteoraPoolWithMint({ ...params, mintKeypair });
}

// Create pool with a specific mint keypair (for vanity addresses)
export interface CreatePoolWithMintParams extends CreatePoolParams {
  mintKeypair: Keypair;
}

export async function createMeteoraPoolWithMint(params: CreatePoolWithMintParams): Promise<{
  transactions: Transaction[];
  mintKeypair: Keypair;
  configKeypair: Keypair;
  poolAddress: PublicKey;
  lastValidBlockHeight: number;
}> {
  const client = getMeteoraClient();
  const connection = getConnection();
  
  // Use provided mint keypair (could be vanity or random)
  const mintKeypair = params.mintKeypair;
  const configKeypair = Keypair.generate();
  
  const creatorPubkey = new PublicKey(params.creatorWallet);
  const leftoverReceiverPubkey = new PublicKey(params.leftoverReceiverWallet ?? params.creatorWallet);
  const platformPubkey = new PublicKey(PLATFORM_FEE_WALLET);
  
  // Prepare initial buy if specified
  // NOTE: use `undefined` (not `null`) to match SDK typings.
  let firstBuyParam:
    | {
        buyer: PublicKey;
        buyAmount: InstanceType<typeof BN>;
        minimumAmountOut: InstanceType<typeof BN>;
        referralTokenAccount: null;
      }
    | undefined;

  if (params.initialBuySol && params.initialBuySol > 0) {
    const amountIn = await prepareSwapAmountParam(
      params.initialBuySol,
      new PublicKey(WSOL_MINT),
      connection
    );
    // Ensure amountIn is a BN - prepareSwapAmountParam may return various types
    const buyAmountBN = amountIn instanceof BN ? amountIn : new BN(String(amountIn));
    firstBuyParam = {
      buyer: creatorPubkey,
      buyAmount: buyAmountBN,
      minimumAmountOut: new BN(1),
      referralTokenAccount: null,
    };
  }

  // Build token metadata URI - points to our edge function that serves Metaplex-standard JSON
  // This includes name, symbol, description, image, and social links
  const supabaseUrl = process.env.SUPABASE_URL || 'https://ptwytypavumcrbofspno.supabase.co';
  const metadataUri = `${supabaseUrl}/functions/v1/token-metadata/${mintKeypair.publicKey.toBase58()}`;

  // Derive pool address
  const { deriveDbcPoolAddress } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const poolAddress = deriveDbcPoolAddress(
    new PublicKey(WSOL_MINT),
    mintKeypair.publicKey,
    configKeypair.publicKey
  );

  // ============================================================================
  // CRITICAL FIX: Use SDK buildCurveWithMarketCap for terminal compatibility
  // ============================================================================
  // The SDK calculates sqrtStartPrice, curve, and migrationQuoteThreshold
  // in a way that external terminals (Axiom/DEXTools/Birdeye) can decode
  // See MIGRATION_FIX_HISTORY.md for previous failed attempts with manual calculation
  const curveConfig = buildCurveConfig();
  
  console.log('[meteora] Using SDK-generated curve config:');
  console.log('[meteora]   sqrtStartPrice:', curveConfig.sqrtStartPrice?.toString());
  console.log('[meteora]   migrationQuoteThreshold:', curveConfig.migrationQuoteThreshold?.toString());
  console.log('[meteora]   curve points:', curveConfig.curve?.length);

  // Create pool with config using SDK-generated curve parameters
  // We spread curveConfig to get sqrtStartPrice, curve, migrationQuoteThreshold, etc.
  // Then override only the account-specific fields
  const { createConfigTx, createPoolTx, swapBuyTx } = await client.pool.createConfigAndPoolWithFirstBuy({
    // Account addresses
    payer: creatorPubkey,
    config: configKeypair.publicKey,
    feeClaimer: platformPubkey, // Platform receives fees, distributes via our system
    leftoverReceiver: leftoverReceiverPubkey, // Terminal compatibility (see comment on CreatePoolParams)
    quoteMint: new PublicKey(WSOL_MINT),
    
    // Spread SDK-generated curve config (includes sqrtStartPrice, curve, migrationQuoteThreshold, etc.)
    ...curveConfig,
    
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
  } as any);


  // Get recent blockhash for all transactions
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  
  // Priority fee settings for faster confirmation
  const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // 0.0001 SOL per compute unit
  const COMPUTE_UNITS = 400_000; // 400k compute units per tx
  
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
  });
  const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: COMPUTE_UNITS,
  });
  
  // Set blockhash, fee payer, add priority fees
  // NOTE: We do NOT pre-sign here - the caller (create-fun.ts) will sign with all required keypairs
  // CRITICAL: Transactions MUST be sent sequentially: config first, then pool, then swap
  // The config account must be initialized on-chain before pool creation references it
  const preparedTransactions: Transaction[] = [];
  
  const addPriorityFees = (tx: Transaction) => {
    // Prepend priority fee instructions
    tx.instructions = [computeUnitsIx, priorityFeeIx, ...tx.instructions];
  };

  // Transaction 1: Create config account (MUST complete before pool tx)
  if (createConfigTx) {
    addPriorityFees(createConfigTx);
    createConfigTx.recentBlockhash = blockhash;
    createConfigTx.feePayer = creatorPubkey;
    // Do NOT sign here - let the caller handle signing with all required keypairs
    preparedTransactions.push(createConfigTx);
    console.log('[meteora] TX1 (createConfig): Ready for signing');
  }

  // Transaction 2: Create pool (requires config account to exist on-chain)
  if (createPoolTx) {
    addPriorityFees(createPoolTx);
    createPoolTx.recentBlockhash = blockhash;
    createPoolTx.feePayer = creatorPubkey;
    // Do NOT sign here - let the caller handle signing with all required keypairs
    preparedTransactions.push(createPoolTx);
    console.log('[meteora] TX2 (createPool): Ready for signing');
  }
  
  // Transaction 3: Initial buy swap (optional)
  if (swapBuyTx) {
    addPriorityFees(swapBuyTx);
    swapBuyTx.recentBlockhash = blockhash;
    swapBuyTx.feePayer = creatorPubkey;
    // Do NOT sign here - let the caller handle signing with all required keypairs
    preparedTransactions.push(swapBuyTx);
    console.log('[meteora] TX3 (swapBuy): Ready for signing');
  }

  console.log('[meteora] Prepared', preparedTransactions.length, 'transactions (unsigned - MUST be sent sequentially)');
  console.log('[meteora] IMPORTANT: TX1 (config) must complete before TX2 (pool) is sent!');

  return {
    transactions: preparedTransactions,
    mintKeypair,
    configKeypair,
    poolAddress,
    lastValidBlockHeight,
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
  
  // Ensure the returned tx is immediately serializable/signable.
  // Some SDK helpers return a Transaction without a recentBlockhash, which later fails with:
  // "Transaction recentBlockhash required".
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  if (transaction instanceof VersionedTransaction) {
    // Versioned tx stores blockhash on the compiled message.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (transaction.message as any).recentBlockhash = blockhash;
  } else {
    // Add priority fees for better inclusion probability.
    const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // 0.0001 SOL per compute unit
    const COMPUTE_UNITS = 400_000;

    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
    });
    const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: COMPUTE_UNITS,
    });

    transaction.instructions = [computeUnitsIx, priorityFeeIx, ...transaction.instructions];
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPubkey;
  }

  return {
    transaction,
    estimatedOutput,
  };
}

// Get pool state from Meteora SDK (accurate on-chain data)
export async function getPoolState(poolAddress: string) {
  const client = getMeteoraClient();
  const poolPubkey = new PublicKey(poolAddress);
  
  console.log('[getPoolState] Fetching pool:', poolAddress);
  
  const poolState = await client.state.getPool(poolPubkey);
  if (!poolState) {
    console.warn('[getPoolState] Pool not found:', poolAddress);
    return null;
  }
  
  // Calculate current price from virtual reserves
  // quoteReserve = virtual SOL (in lamports, 9 decimals)
  // baseReserve = virtual tokens (in smallest unit, TOKEN_DECIMALS decimals)
  const virtualSol = Number(poolState.quoteReserve.toString()) / 1e9;
  const virtualToken = Number(poolState.baseReserve.toString()) / Math.pow(10, TOKEN_DECIMALS);
  const price = virtualToken > 0 ? virtualSol / virtualToken : 0;
  
  console.log('[getPoolState] Raw reserves:', {
    quoteReserve: poolState.quoteReserve.toString(),
    baseReserve: poolState.baseReserve.toString(),
    virtualSol,
    virtualToken,
    price,
    isMigrated: poolState.isMigrated,
  });
  
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
