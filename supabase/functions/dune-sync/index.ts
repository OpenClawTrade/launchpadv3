import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// New Dune Upload API endpoints (v1/uploads)
const DUNE_API_BASE = 'https://api.dune.com/api/v1/uploads';
const DUNE_NAMESPACE = 'ai67xlaunch';

interface PlatformStats {
  timestamp: string;
  total_tokens: number;
  graduated_tokens: number;
  active_tokens: number;
  total_transactions: number;
  total_volume_sol: number;
  unique_traders: number;
  total_users: number;
  total_fees_earned_sol: number;
  total_market_cap_sol: number;
}

interface TokenSnapshot {
  timestamp: string;
  token_id: string;
  mint_address: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  dbc_pool_address: string | null;
  damm_pool_address: string | null;
  price_sol: number;
  market_cap_sol: number;
  volume_24h_sol: number;
  holder_count: number;
  bonding_curve_progress: number;
  status: string;
  created_at: string;
  graduated_at: string | null;
}

interface TransactionRecord {
  id: string;
  token_id: string;
  user_wallet: string;
  transaction_type: string;
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  creator_fee_sol: number;
  system_fee_sol: number;
  signature: string;
  created_at: string;
}

// Table schemas for Dune
const TABLE_SCHEMAS = {
  platform_stats: [
    { name: 'timestamp', type: 'timestamp' },
    { name: 'total_tokens', type: 'integer' },
    { name: 'graduated_tokens', type: 'integer' },
    { name: 'active_tokens', type: 'integer' },
    { name: 'total_transactions', type: 'integer' },
    { name: 'total_volume_sol', type: 'double' },
    { name: 'unique_traders', type: 'integer' },
    { name: 'total_users', type: 'integer' },
    { name: 'total_fees_earned_sol', type: 'double' },
    { name: 'total_market_cap_sol', type: 'double' },
  ],
  token_snapshots: [
    { name: 'timestamp', type: 'timestamp' },
    { name: 'token_id', type: 'varchar' },
    { name: 'mint_address', type: 'varchar' },
    { name: 'name', type: 'varchar' },
    { name: 'ticker', type: 'varchar' },
    { name: 'creator_wallet', type: 'varchar' },
    { name: 'dbc_pool_address', type: 'varchar', nullable: true },
    { name: 'damm_pool_address', type: 'varchar', nullable: true },
    { name: 'price_sol', type: 'double' },
    { name: 'market_cap_sol', type: 'double' },
    { name: 'volume_24h_sol', type: 'double' },
    { name: 'holder_count', type: 'integer' },
    { name: 'bonding_curve_progress', type: 'double' },
    { name: 'status', type: 'varchar' },
    { name: 'created_at', type: 'timestamp' },
    { name: 'graduated_at', type: 'timestamp', nullable: true },
  ],
  transactions: [
    { name: 'id', type: 'varchar' },
    { name: 'token_id', type: 'varchar' },
    { name: 'user_wallet', type: 'varchar' },
    { name: 'transaction_type', type: 'varchar' },
    { name: 'sol_amount', type: 'double' },
    { name: 'token_amount', type: 'double' },
    { name: 'price_per_token', type: 'double' },
    { name: 'creator_fee_sol', type: 'double' },
    { name: 'system_fee_sol', type: 'double' },
    { name: 'signature', type: 'varchar' },
    { name: 'created_at', type: 'timestamp' },
  ],
};

// Create a table on Dune
async function createDuneTable(
  apiKey: string,
  tableName: string,
  schema: { name: string; type: string; nullable?: boolean }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Creating Dune table: ${DUNE_NAMESPACE}.${tableName}`);
    
    const response = await fetch(DUNE_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-Api-Key': apiKey,
      },
      body: JSON.stringify({
        namespace: DUNE_NAMESPACE,
        table_name: tableName,
        schema: schema,
        is_private: false,
        description: `AI67X Launchpad - ${tableName}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Table already exists is not an error
      if (errorText.includes('already exists')) {
        console.log(`Table ${tableName} already exists`);
        return { success: true };
      }
      console.error(`Failed to create table ${tableName}:`, errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Created table ${tableName}:`, result);
    return { success: true };
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

// Insert data into a Dune table
async function insertToDune(
  apiKey: string,
  tableName: string,
  data: Record<string, unknown>[]
): Promise<{ success: boolean; error?: string; rows_written?: number }> {
  try {
    if (data.length === 0) {
      console.log(`No data to insert for ${tableName}`);
      return { success: true, rows_written: 0 };
    }

    console.log(`Inserting ${data.length} rows to ${DUNE_NAMESPACE}.${tableName}`);

    // Convert to NDJSON format
    const ndjson = data.map(row => JSON.stringify(row)).join('\n');

    const response = await fetch(`${DUNE_API_BASE}/${DUNE_NAMESPACE}/${tableName}/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'X-Dune-Api-Key': apiKey,
      },
      body: ndjson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to insert to ${tableName}:`, errorText);
      
      // If table doesn't exist, create it first
      if (errorText.includes('not found') || errorText.includes('does not exist')) {
        console.log(`Table ${tableName} not found, creating it...`);
        const schema = TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];
        if (schema) {
          const createResult = await createDuneTable(apiKey, tableName, schema);
          if (createResult.success) {
            // Retry insert after table creation
            return insertToDune(apiKey, tableName, data);
          }
          return createResult;
        }
      }
      
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Inserted ${data.length} rows to ${tableName}:`, result);
    return { success: true, rows_written: data.length };
  } catch (error) {
    console.error(`Error inserting to ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

// Ensure all tables exist
async function ensureTablesExist(apiKey: string): Promise<void> {
  console.log('Ensuring Dune tables exist...');
  
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    await createDuneTable(apiKey, tableName, schema);
  }
}

async function fetchPlatformStats(supabase: SupabaseClient): Promise<PlatformStats> {
  const timestamp = new Date().toISOString();

  const [tokensResult, transactionsResult, usersResult, feesResult] = await Promise.all([
    supabase.from('tokens').select('status, market_cap_sol', { count: 'exact' }),
    supabase.from('launchpad_transactions').select('sol_amount, user_wallet'),
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('fee_claims').select('amount_sol'),
  ]);

  const tokens = tokensResult.data || [];
  const transactions = transactionsResult.data || [];
  const totalUsers = usersResult.count || 0;
  const fees = feesResult.data || [];

  const totalTokens = tokens.length;
  const graduatedTokens = tokens.filter((t: { status: string }) => t.status === 'graduated').length;
  const activeTokens = tokens.filter((t: { status: string }) => t.status === 'active').length;
  const totalMarketCap = tokens.reduce((sum: number, t: { market_cap_sol: number | null }) => sum + (Number(t.market_cap_sol) || 0), 0);

  const totalTransactions = transactions.length;
  const totalVolume = transactions.reduce((sum: number, t: { sol_amount: number | null }) => sum + (Number(t.sol_amount) || 0), 0);
  const uniqueTraders = new Set(transactions.map((t: { user_wallet: string }) => t.user_wallet)).size;

  const totalFeesEarned = fees.reduce((sum: number, f: { amount_sol: number | null }) => sum + (Number(f.amount_sol) || 0), 0);

  return {
    timestamp,
    total_tokens: totalTokens,
    graduated_tokens: graduatedTokens,
    active_tokens: activeTokens,
    total_transactions: totalTransactions,
    total_volume_sol: totalVolume,
    unique_traders: uniqueTraders,
    total_users: totalUsers,
    total_fees_earned_sol: totalFeesEarned,
    total_market_cap_sol: totalMarketCap,
  };
}

async function fetchTokenSnapshots(supabase: SupabaseClient): Promise<TokenSnapshot[]> {
  const timestamp = new Date().toISOString();

  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('id, mint_address, name, ticker, creator_wallet, dbc_pool_address, damm_pool_address, price_sol, market_cap_sol, volume_24h_sol, holder_count, bonding_curve_progress, status, created_at, graduated_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }

  return (tokens || []).map((token: {
    id: string;
    mint_address: string;
    name: string;
    ticker: string;
    creator_wallet: string;
    dbc_pool_address: string | null;
    damm_pool_address: string | null;
    price_sol: number | null;
    market_cap_sol: number | null;
    volume_24h_sol: number | null;
    holder_count: number | null;
    bonding_curve_progress: number | null;
    status: string | null;
    created_at: string;
    graduated_at: string | null;
  }) => ({
    timestamp,
    token_id: token.id,
    mint_address: token.mint_address,
    name: token.name,
    ticker: token.ticker,
    creator_wallet: token.creator_wallet,
    dbc_pool_address: token.dbc_pool_address,
    damm_pool_address: token.damm_pool_address,
    price_sol: Number(token.price_sol) || 0,
    market_cap_sol: Number(token.market_cap_sol) || 0,
    volume_24h_sol: Number(token.volume_24h_sol) || 0,
    holder_count: token.holder_count || 0,
    bonding_curve_progress: Number(token.bonding_curve_progress) || 0,
    status: token.status || 'active',
    created_at: token.created_at,
    graduated_at: token.graduated_at,
  }));
}

async function fetchRecentTransactions(supabase: SupabaseClient): Promise<TransactionRecord[]> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: transactions, error } = await supabase
    .from('launchpad_transactions')
    .select('*')
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (transactions || []).map((tx: {
    id: string;
    token_id: string;
    user_wallet: string;
    transaction_type: string;
    sol_amount: number | null;
    token_amount: number | null;
    price_per_token: number | null;
    creator_fee_sol: number | null;
    system_fee_sol: number | null;
    signature: string;
    created_at: string;
  }) => ({
    id: tx.id,
    token_id: tx.token_id,
    user_wallet: tx.user_wallet,
    transaction_type: tx.transaction_type,
    sol_amount: Number(tx.sol_amount) || 0,
    token_amount: Number(tx.token_amount) || 0,
    price_per_token: Number(tx.price_per_token) || 0,
    creator_fee_sol: Number(tx.creator_fee_sol) || 0,
    system_fee_sol: Number(tx.system_fee_sol) || 0,
    signature: tx.signature,
    created_at: tx.created_at,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const duneApiKey = Deno.env.get('DUNE_API_KEY');
    if (!duneApiKey) {
      console.error('DUNE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DUNE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting Dune sync...');

    // First ensure all tables exist
    await ensureTablesExist(duneApiKey);

    // Fetch all data in parallel
    const [platformStats, tokenSnapshots, recentTransactions] = await Promise.all([
      fetchPlatformStats(supabase),
      fetchTokenSnapshots(supabase),
      fetchRecentTransactions(supabase),
    ]);

    console.log(`Fetched: ${tokenSnapshots.length} tokens, ${recentTransactions.length} recent transactions`);
    console.log('Platform stats:', platformStats);

    // Insert data to Dune tables
    const [statsResult, tokensResult, txResult] = await Promise.all([
      insertToDune(duneApiKey, 'platform_stats', [platformStats] as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'token_snapshots', tokenSnapshots as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'transactions', recentTransactions as unknown as Record<string, unknown>[]),
    ]);

    const results = {
      timestamp: new Date().toISOString(),
      platform_stats: statsResult,
      token_snapshots: { ...tokensResult, count: tokenSnapshots.length },
      transactions: { ...txResult, count: recentTransactions.length },
    };

    const allSuccess = statsResult.success && tokensResult.success && txResult.success;

    console.log('Dune sync completed:', results);

    return new Response(
      JSON.stringify({ success: allSuccess, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dune sync error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
