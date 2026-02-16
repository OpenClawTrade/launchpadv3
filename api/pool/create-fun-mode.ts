import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import BN from 'bn.js';
import {
  CpAmm,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  getBaseFeeParams,
  BaseFeeMode,
  ActivationType,
} from '@meteora-ag/cp-amm-sdk';

// wSOL mint address
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Metaplex Token Metadata Program
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Manually serialize CreateMetadataAccountV3 instruction data (Borsh).
 * Avoids needing @metaplex-foundation/mpl-token-metadata dependency.
 */
function buildCreateMetadataV3Ix(
  metadataPDA: PublicKey,
  mint: PublicKey,
  mintAuthority: PublicKey,
  payer: PublicKey,
  updateAuthority: PublicKey,
  name: string,
  symbol: string,
  uri: string,
): TransactionInstruction {
  // Borsh-serialize the instruction data
  const nameBytes = Buffer.from(name, 'utf8');
  const symbolBytes = Buffer.from(symbol, 'utf8');
  const uriBytes = Buffer.from(uri, 'utf8');

  const buffers: Buffer[] = [];
  // Discriminator: 33 (CreateMetadataAccountV3)
  buffers.push(Buffer.from([33]));
  // CreateMetadataAccountArgsV3 → data: DataV2
  // name (borsh string: u32 LE length + bytes)
  const nl = Buffer.alloc(4); nl.writeUInt32LE(nameBytes.length); buffers.push(nl, nameBytes);
  // symbol
  const sl = Buffer.alloc(4); sl.writeUInt32LE(symbolBytes.length); buffers.push(sl, symbolBytes);
  // uri
  const ul = Buffer.alloc(4); ul.writeUInt32LE(uriBytes.length); buffers.push(ul, uriBytes);
  // seller_fee_basis_points: u16 = 0
  buffers.push(Buffer.alloc(2));
  // creators: Option<Vec<Creator>> = None
  buffers.push(Buffer.from([0]));
  // collection: Option<Collection> = None
  buffers.push(Buffer.from([0]));
  // uses: Option<Uses> = None
  buffers.push(Buffer.from([0]));
  // is_mutable: bool = true
  buffers.push(Buffer.from([1]));
  // collection_details: Option<CollectionDetails> = None
  buffers.push(Buffer.from([0]));

  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: mintAuthority, isSigner: true, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat(buffers),
  });
}

// Retry helper for RPC rate limits
async function getBlockhashWithRetry(
  connection: Connection,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await connection.getLatestBlockhash('confirmed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('max usage reached')) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[create-fun-mode] Rate limited. Retrying in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed to get blockhash after ${maxRetries} retries`);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) throw new Error('TREASURY_PRIVATE_KEY not configured');
  try {
    if (raw.startsWith('[')) {
      const bytes = new Uint8Array(JSON.parse(raw));
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      throw new Error(`Invalid key length: ${bytes.length}`);
    }
    const decoded: Uint8Array = bs58.decode(raw);
    if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    if (decoded.length === 32) return Keypair.fromSeed(decoded);
    throw new Error(`Invalid key length: ${decoded.length}`);
  } catch (e) {
    throw new Error(`Invalid TREASURY_PRIVATE_KEY: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      ticker,
      description,
      imageUrl,
      phantomWallet,
      totalSupply = 1_000_000_000, // Default 1B tokens
      lpTokenAmount = 10_000_000, // Tokens to seed in pool
      lpSolAmount = 0.5, // SOL to seed in pool
    } = req.body;

    if (!name || !ticker || !phantomWallet) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker, phantomWallet' });
    }

    try {
      new PublicKey(phantomWallet);
    } catch {
      return res.status(400).json({ error: 'Invalid phantomWallet address' });
    }

    const validTotalSupply = Math.max(1000, Math.min(1_000_000_000_000, Number(totalSupply) || 1_000_000_000));
    const validLpTokens = Math.max(1, Math.min(validTotalSupply, Number(lpTokenAmount) || 10_000_000));
    const validLpSol = Math.max(0.001, Math.min(100, Number(lpSolAmount) || 0.5));

    console.log('[create-fun-mode] Creating FUN mode token:', {
      name, ticker, phantomWallet,
      totalSupply: validTotalSupply,
      lpTokens: validLpTokens,
      lpSol: validLpSol,
    });

    
    const rpcUrl = process.env.HELIUS_RPC_URL;
    if (!rpcUrl) throw new Error('HELIUS_RPC_URL not configured');
    const connection = new Connection(rpcUrl, 'confirmed');

    const phantomPubkey = new PublicKey(phantomWallet);
    const mintKeypair = Keypair.generate();
    const mintPubkey = mintKeypair.publicKey;
    const decimals = 9;
    const mintAddress = mintPubkey.toBase58();

    // ===== Upload Metaplex-compatible metadata JSON to storage =====
    const supabase = getSupabase();
    const tokenName = name.slice(0, 32);
    const tokenSymbol = ticker.toUpperCase().slice(0, 10);
    const tokenDescription = description?.slice(0, 500) || `${tokenName} - FUN mode token`;
    const tokenImage = imageUrl || '';

    const metadataJson = {
      name: tokenName,
      symbol: tokenSymbol,
      description: tokenDescription,
      image: tokenImage,
      external_url: `https://tuna.fun/t/${tokenSymbol}`,
      seller_fee_basis_points: 0,
      properties: {
        files: tokenImage ? [{ uri: tokenImage, type: 'image/png' }] : [],
        category: 'image',
        creators: [],
      },
    };

    const jsonPath = `token-metadata/${mintAddress}.json`;
    let metadataUri = '';
    try {
      const jsonBlob = new Blob([JSON.stringify(metadataJson, null, 2)], { type: 'application/json' });
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(jsonPath, jsonBlob, { contentType: 'application/json', upsert: true, cacheControl: '60' });
      if (uploadError) {
        console.warn('[create-fun-mode] ⚠️ Metadata JSON upload failed:', uploadError.message);
      } else {
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(jsonPath);
        metadataUri = publicUrl;
        console.log('[create-fun-mode] ✅ Metadata JSON uploaded:', metadataUri);
      }
    } catch (metaErr) {
      console.warn('[create-fun-mode] ⚠️ Metadata upload error (non-fatal):', metaErr);
    }

    // ===== TX1: Create Mint + Metadata + Mint Supply to Creator =====
    const tx1 = new Transaction();

    // Priority fees to ensure TX lands on-chain
    tx1.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 })
    );

    // Create mint account
    const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    tx1.add(
      SystemProgram.createAccount({
        fromPubkey: phantomPubkey,
        newAccountPubkey: mintPubkey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mintPubkey, decimals, phantomPubkey, null, TOKEN_PROGRAM_ID)
    );

    // ===== Add Metaplex on-chain metadata =====
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID,
    );
    tx1.add(buildCreateMetadataV3Ix(
      metadataPDA, mintPubkey, phantomPubkey, phantomPubkey, phantomPubkey,
      tokenName, tokenSymbol, metadataUri,
    ));

    // Create ATA for creator and mint total supply
    const creatorAta = getAssociatedTokenAddressSync(mintPubkey, phantomPubkey);
    tx1.add(
      createAssociatedTokenAccountInstruction(phantomPubkey, creatorAta, phantomPubkey, mintPubkey)
    );

    const totalSupplyLamports = BigInt(validTotalSupply) * BigInt(10 ** decimals);
    tx1.add(
      createMintToInstruction(mintPubkey, creatorAta, phantomPubkey, totalSupplyLamports)
    );

    // Set blockhash and fee payer for TX1
    const latest1 = await getBlockhashWithRetry(connection);
    tx1.recentBlockhash = latest1.blockhash;
    tx1.feePayer = phantomPubkey;

    // ===== TX2: Create DAMM V2 (CP-AMM) Pool with Zero Fees =====
    const cpAmm = new CpAmm(connection);

    const lpTokenLamports = new BN(validLpTokens).mul(new BN(10).pow(new BN(decimals)));
    const lpSolLamports = new BN(Math.round(validLpSol * LAMPORTS_PER_SOL));
    const positionNftMint = Keypair.generate();

    // Prepare pool creation params
    const { initSqrtPrice, liquidityDelta } = cpAmm.preparePoolCreationParams({
      tokenAAmount: lpTokenLamports,
      tokenBAmount: lpSolLamports,
      minSqrtPrice: MIN_SQRT_PRICE,
      maxSqrtPrice: MAX_SQRT_PRICE,
    });

    // Minimal fee config (0.01% - lowest allowed by CP-AMM)
    const minBaseFee = getBaseFeeParams({
      baseFeeMode: BaseFeeMode.FeeTimeSchedulerLinear,
      feeTimeSchedulerParam: {
        startingFeeBps: 1,
        endingFeeBps: 1,
        numberOfPeriod: 0,
        totalDuration: 0,
      },
    }, 9, ActivationType.Slot);

    console.log('[create-fun-mode] Creating CP-AMM pool:', {
      mintAddress: mintPubkey.toBase58(),
      lpTokens: validLpTokens,
      lpSol: validLpSol,
      initSqrtPrice: initSqrtPrice.toString(),
    });

    const { tx: poolTx, pool: poolAddress, position } = await cpAmm.createCustomPool({
      payer: phantomPubkey,
      creator: phantomPubkey,
      positionNft: positionNftMint.publicKey,
      tokenAMint: mintPubkey,
      tokenBMint: WSOL_MINT,
      tokenAAmount: lpTokenLamports,
      tokenBAmount: lpSolLamports,
      sqrtMinPrice: MIN_SQRT_PRICE,
      sqrtMaxPrice: MAX_SQRT_PRICE,
      initSqrtPrice,
      liquidityDelta,
      poolFees: {
        baseFee: minBaseFee,
        padding: [],
        dynamicFee: null,
      },
      hasAlphaVault: false,
      collectFeeMode: 0,
      activationPoint: null,
      activationType: 0, // slot-based, immediate
      tokenAProgram: TOKEN_PROGRAM_ID,
      tokenBProgram: TOKEN_PROGRAM_ID,
      isLockLiquidity: false, // LP NOT locked
    });

    // Add priority fees to pool TX
    const priorityIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
    ];
    // Prepend priority fee instructions to the pool transaction
    poolTx.instructions.unshift(...priorityIxs);

    // Set blockhash for pool TX
    const latest2 = await getBlockhashWithRetry(connection);
    poolTx.recentBlockhash = latest2.blockhash;
    poolTx.feePayer = phantomPubkey;

    console.log('[create-fun-mode] Pool created:', {
      poolAddress: poolAddress.toBase58(),
      position: position.toBase58(),
    });

    // ===== Serialize both transactions =====
    const serializedTransactions: string[] = [];
    const txRequiredKeypairs: string[][] = [];
    const ephemeralKeypairs: Record<string, string> = {};
    const txIsVersioned: boolean[] = [false, false];

    // TX1: mint keypair needs to sign
    const tx1Bytes = tx1.serialize({ requireAllSignatures: false, verifySignatures: false });
    serializedTransactions.push(tx1Bytes.toString('base64'));
    txRequiredKeypairs.push([mintKeypair.publicKey.toBase58()]);

    // TX2: positionNft keypair needs to sign
    const tx2Bytes = poolTx.serialize({ requireAllSignatures: false, verifySignatures: false });
    serializedTransactions.push(tx2Bytes.toString('base64'));
    txRequiredKeypairs.push([positionNftMint.publicKey.toBase58()]);

    // Export ephemeral keypairs
    ephemeralKeypairs[mintKeypair.publicKey.toBase58()] = bs58.encode(mintKeypair.secretKey);
    ephemeralKeypairs[positionNftMint.publicKey.toBase58()] = bs58.encode(positionNftMint.secretKey);

    // mintAddress already defined above
    const poolAddressStr = poolAddress.toBase58();

    // Calculate implied values
    const impliedPricePerToken = validLpSol / validLpTokens;
    const impliedMarketCap = impliedPricePerToken * validTotalSupply;

    console.log('[create-fun-mode] ✅ Transactions prepared:', {
      mintAddress,
      poolAddress: poolAddressStr,
      impliedPricePerToken,
      impliedMarketCapSol: impliedMarketCap,
    });

    return res.status(200).json({
      success: true,
      mintAddress,
      poolAddress: poolAddressStr,
      unsignedTransactions: serializedTransactions,
      txLabels: ['Create Token + Metadata & Mint Supply', 'Create Pool (0.01% Fee, Unlocked LP)'],
      txRequiredKeypairs,
      ephemeralKeypairs,
      txIsVersioned,
      txCount: 2,
      impliedPricePerToken,
      impliedMarketCapSol: impliedMarketCap,
      requiresPhantomSignature: true,
      phantomSignsFirst: true,
      message: 'FUN mode: 2-TX sequential signing. LP is NOT locked, 0.01% trading fees.',
    });
  } catch (error) {
    console.error('[create-fun-mode] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: msg });
  }
}
