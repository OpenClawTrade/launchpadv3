import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoolStateResponse {
  tokenId: string;
  name: string;
  ticker: string;
  chain: string;
  evmTokenAddress: string;
  evmPoolAddress: string;
  creatorWallet: string;
  creatorFeeBps: number;
  fairLaunchEndsAt: string | null;
  isFairLaunchActive: boolean;
  startingMcapUsd: number;
  totalClaimedEth: number;
  totalBuybackEth: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokenId = url.searchParams.get('tokenId');
    const evmTokenAddress = url.searchParams.get('evmTokenAddress');

    if (!tokenId && !evmTokenAddress) {
      return new Response(
        JSON.stringify({ error: 'Provide tokenId or evmTokenAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch token
    let query = supabase
      .from('fun_tokens')
      .select('*')
      .eq('chain', 'base');

    if (tokenId) {
      query = query.eq('id', tokenId);
    } else if (evmTokenAddress) {
      query = query.eq('evm_token_address', evmTokenAddress);
    }

    const { data: token, error: tokenError } = await query.single();

    if (tokenError || !token) {
      return new Response(
        JSON.stringify({ error: 'Token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch total claimed ETH
    const { data: claims } = await supabase
      .from('base_creator_claims')
      .select('claimed_eth')
      .eq('fun_token_id', token.id);

    const totalClaimedEth = claims?.reduce((sum, c) => sum + Number(c.claimed_eth || 0), 0) ?? 0;

    // Fetch total buyback ETH
    const { data: buybacks } = await supabase
      .from('base_buybacks')
      .select('eth_amount')
      .eq('fun_token_id', token.id);

    const totalBuybackEth = buybacks?.reduce((sum, b) => sum + Number(b.eth_amount || 0), 0) ?? 0;

    // Check if fair launch is active
    const now = new Date();
    const fairLaunchEndsAt = token.fair_launch_ends_at ? new Date(token.fair_launch_ends_at) : null;
    const isFairLaunchActive = fairLaunchEndsAt ? now < fairLaunchEndsAt : false;

    const response: PoolStateResponse = {
      tokenId: token.id,
      name: token.name,
      ticker: token.ticker,
      chain: token.chain,
      evmTokenAddress: token.evm_token_address,
      evmPoolAddress: token.evm_pool_address,
      creatorWallet: token.creator_wallet,
      creatorFeeBps: token.creator_fee_bps ?? 8000,
      fairLaunchEndsAt: token.fair_launch_ends_at,
      isFairLaunchActive,
      startingMcapUsd: token.starting_mcap_usd ?? 5000,
      totalClaimedEth,
      totalBuybackEth,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
