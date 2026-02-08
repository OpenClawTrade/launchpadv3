import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTokenRequest {
  name: string;
  ticker: string;
  creatorWallet: string;
  evmTokenAddress: string;
  evmPoolAddress: string;
  evmFactoryTxHash: string;
  creatorFeeBps?: number;
  fairLaunchDurationMins?: number;
  startingMcapUsd?: number;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateTokenRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.ticker || !body.creatorWallet) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, ticker, creatorWallet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.evmTokenAddress || !body.evmPoolAddress || !body.evmFactoryTxHash) {
      return new Response(
        JSON.stringify({ error: 'Missing EVM contract addresses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fee structure: 2% total (1% platform + 1% creator - fixed split)
    // creatorFeeBps is kept for backward compatibility but not used in fee calculation
    const creatorFeeBps = 5000; // Fixed 50% = 1% of 2% total goes to creator

    // Create token via backend function
    const { data, error } = await supabase.rpc('backend_create_base_token', {
      p_name: body.name,
      p_ticker: body.ticker.toUpperCase(),
      p_creator_wallet: body.creatorWallet,
      p_evm_token_address: body.evmTokenAddress,
      p_evm_pool_address: body.evmPoolAddress,
      p_evm_factory_tx_hash: body.evmFactoryTxHash,
      p_creator_fee_bps: creatorFeeBps,
      p_fair_launch_duration_mins: body.fairLaunchDurationMins ?? 5,
      p_starting_mcap_usd: body.startingMcapUsd ?? 5000,
      p_description: body.description ?? null,
      p_image_url: body.imageUrl ?? null,
      p_website_url: body.websiteUrl ?? null,
      p_twitter_url: body.twitterUrl ?? null,
    });

    if (error) {
      console.error('Error creating Base token:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Base token created:', data);

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: data,
        message: `Token ${body.name} (${body.ticker}) created on Base`,
      }),
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
