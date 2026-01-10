// TRENCHES Launchpad Configuration
// This file contains all the constants and configuration for the launchpad

// Meteora Program IDs
export const DBC_PROGRAM_ID = 'dbcpH6iFEdtCcCHjVxMo2LPoWENUjBxHqPhn8wF8izT';
export const DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';

// Token Mints
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Platform Configuration
export const PLATFORM_FEE_WALLET = '7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2';

// Token settings
export const TOKEN_DECIMALS = 6;
export const TOTAL_SUPPLY = 1_000_000_000;

// Bonding curve
export const INITIAL_VIRTUAL_SOL = 30;
export const GRADUATION_THRESHOLD_SOL = 85;

// Fees - 2% total
export const TRADING_FEE_BPS = 200; // 2% trading fee
export const CREATOR_FEE_SHARE = 0.5; // 50% of fees to creator
export const SYSTEM_FEE_SHARE = 0.5; // 50% of fees to platform

// LP distribution on graduation (100% locked to platform)
export const PARTNER_LP_PERCENTAGE = 0;
export const CREATOR_LP_PERCENTAGE = 0;
export const PARTNER_LOCKED_LP_PERCENTAGE = 100;
export const CREATOR_LOCKED_LP_PERCENTAGE = 0;

// Post-graduation fees
export const MIGRATED_POOL_FEE_BPS = 200; // 2% on DAMM V2

// Token type
export const TOKEN_TYPE = 0; // 0 = SPL Token (not Token-2022)
export const TOKEN_UPDATE_AUTHORITY = 1; // 1 = immutable metadata

// Environment
export const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || '';
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || '';

// Validate required environment variables
export function validateEnv() {
  const required = ['HELIUS_RPC_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
