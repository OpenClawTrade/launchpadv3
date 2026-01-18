import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUNE_API_URL = 'https://api.dune.com/api/v1/table';
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
  [key: string]: string | number; // Index signature for Record compatibility
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
  [key: string]: string | number | null; // Index signature for Record compatibility
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
  [key: string]: string | number; // Index signature for Record compatibility
}

async function pushToDune(
  apiKey: string,
  tableName: string,
  data: Record<string, unknown>[],
  isCreate = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (data.length === 0) {
      console.log(`No data to push for ${tableName}`);
      return { success: true };
    }

    const endpoint = isCreate
      ? `${DUNE_API_URL}/${DUNE_NAMESPACE}/${tableName}/create`
      : `${DUNE_API_URL}/${DUNE_NAMESPACE}/${tableName}/insert`;

    // Convert to NDJSON format
    const ndjson = data.map(row => JSON.stringify(row)).join('\n');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'X-Dune-Api-Key': apiKey,
      },
      body: ndjson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Dune API error for ${tableName}:`, errorText);
      
      // If table doesn't exist, try creating it
      if (response.status === 404 && !isCreate) {
        console.log(`Table ${tableName} not found, attempting to create...`);
        return pushToDune(apiKey, tableName, data, true);
      }
      
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Successfully pushed ${data.length} rows to ${tableName}:`, result);
    return { success: true };
  } catch (error) {
    console.error(`Error pushing to Dune ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

async function fetchPlatformStats(supabase: SupabaseClient): Promise<PlatformStats> {
  const timestamp = new Date().toISOString();

  // Aggregate platform stats
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
  // Fetch transactions from last 15 minutes
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

    // Fetch all data in parallel
    const [platformStats, tokenSnapshots, recentTransactions] = await Promise.all([
      fetchPlatformStats(supabase),
      fetchTokenSnapshots(supabase),
      fetchRecentTransactions(supabase),
    ]);

    console.log(`Fetched: ${tokenSnapshots.length} tokens, ${recentTransactions.length} recent transactions`);

    // Push data to Dune in parallel
    const [statsResult, tokensResult, txResult] = await Promise.all([
      pushToDune(duneApiKey, 'platform_stats', [platformStats] as Record<string, unknown>[]),
      pushToDune(duneApiKey, 'token_snapshots', tokenSnapshots as unknown as Record<string, unknown>[]),
      pushToDune(duneApiKey, 'transactions', recentTransactions as unknown as Record<string, unknown>[]),
    ]);

    const results = {
      timestamp: new Date().toISOString(),
      platform_stats: statsResult,
      token_snapshots: { ...tokensResult, count: tokenSnapshots.length },
      transactions: { ...txResult, count: recentTransactions.length },
    };

    console.log('Dune sync completed:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
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
