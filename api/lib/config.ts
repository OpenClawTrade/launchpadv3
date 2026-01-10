// TRENCHES Launchpad Configuration
// Full Meteora SDK Integration - No Mock Data
// All operations are real on-chain Solana transactions

// Meteora Program IDs (Mainnet)
export const DBC_PROGRAM_ID = 'dbcpH6iFEdtCcCHjVxMo2LPoWENUjBxHqPhn8wF8izT';
export const DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';

// Token Mints
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Platform Configuration - Treasury Wallet
// This wallet receives all platform fees and locked LP tokens
export const PLATFORM_FEE_WALLET = '7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2';

// Token settings
export const TOKEN_DECIMALS = 6;
export const TOTAL_SUPPLY = 1_000_000_000;

// Bonding curve parameters
export const INITIAL_VIRTUAL_SOL = 30; // Starting virtual SOL reserves
export const GRADUATION_THRESHOLD_SOL = 85; // SOL needed to graduate

// Trading fees - 2% total to treasury
// 100% of 2% goes to platform treasury wallet
// Treasury handles all fee distribution (buybacks, operations, etc.)
export const TRADING_FEE_BPS = 200; // 2% (200 basis points)
export const CREATOR_FEE_SHARE = 0; // 0% - No on-chain creator fees
export const SYSTEM_FEE_SHARE = 1.0; // 100% of fees go to treasury

// LP distribution on graduation
// 100% of LP locked to platform treasury - no rugs possible
export const PARTNER_LP_PERCENTAGE = 0;
export const CREATOR_LP_PERCENTAGE = 0;
export const PARTNER_LOCKED_LP_PERCENTAGE = 100; // Platform gets all locked LP
export const CREATOR_LOCKED_LP_PERCENTAGE = 0;

// Post-graduation DAMM V2 pool fees
export const MIGRATED_POOL_FEE_BPS = 200; // 2% on graduated pools

// Token type configuration
export const TOKEN_TYPE = 0; // 0 = SPL Token (not Token-2022)
export const TOKEN_UPDATE_AUTHORITY = 1; // 1 = immutable metadata

// Environment variables
export const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || '';
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || '';

// Validate required environment variables
export function validateEnv() {
  const required = [
    'HELIUS_RPC_URL', 
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'TREASURY_PRIVATE_KEY',
  ];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
