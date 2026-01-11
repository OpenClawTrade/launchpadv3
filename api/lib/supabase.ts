import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.js';

// Create Supabase client with service role key for backend operations
export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Token type definition
export interface Token {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  creator_id: string | null;
  dbc_pool_address: string | null;
  damm_pool_address: string | null;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  total_supply: number;
  bonding_curve_progress: number;
  graduation_threshold_sol: number;
  price_sol: number;
  market_cap_sol: number;
  volume_24h_sol: number;
  status: 'bonding' | 'graduated' | 'failed';
  migration_status: string;
  holder_count: number;
  graduated_at: string | null;
  created_at: string;
  updated_at: string;
}

// Get token by ID
export async function getTokenById(tokenId: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', tokenId)
    .single();
  
  if (error) {
    console.error('Error fetching token:', error);
    return null;
  }
  
  return data as Token;
}

// Get token by mint address
export async function getTokenByMint(mintAddress: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .single();
  
  if (error) {
    console.error('Error fetching token:', error);
    return null;
  }
  
  return data as Token;
}

// Update token
export async function updateToken(tokenId: string, updates: Partial<Token>) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('tokens')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', tokenId);
  
  if (error) {
    throw new Error(`Failed to update token: ${error.message}`);
  }
}

// Acquire claim lock
export async function acquireClaimLock(tokenId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.rpc('acquire_claim_lock', {
    p_token_id: tokenId,
    p_lock_duration_seconds: 60,
  });
  return !!data;
}

// Release claim lock
export async function releaseClaimLock(tokenId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.rpc('release_claim_lock', { p_token_id: tokenId });
}
