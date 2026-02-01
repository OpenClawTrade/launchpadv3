import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimFeesRequest {
  tokenId: string;
  creatorWallet: string;
  claimedEth: number;
  txHash: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ClaimFeesRequest = await req.json();

    // Validate required fields
    if (!body.tokenId || !body.creatorWallet || !body.txHash) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tokenId, creatorWallet, txHash' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body.claimedEth !== 'number' || body.claimedEth <= 0) {
      return new Response(
        JSON.stringify({ error: 'claimedEth must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token exists and is on Base chain
    const { data: token, error: tokenError } = await supabase
      .from('fun_tokens')
      .select('id, creator_wallet, chain')
      .eq('id', body.tokenId)
      .eq('chain', 'base')
      .single();

    if (tokenError || !token) {
      return new Response(
        JSON.stringify({ error: 'Base token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the claimer is the creator
    if (token.creator_wallet.toLowerCase() !== body.creatorWallet.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Only the token creator can claim fees' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate tx hash
    const { data: existingClaim } = await supabase
      .from('base_creator_claims')
      .select('id')
      .eq('tx_hash', body.txHash)
      .single();

    if (existingClaim) {
      return new Response(
        JSON.stringify({ error: 'This transaction has already been recorded' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the claim
    const { data: claimId, error: claimError } = await supabase.rpc('backend_record_base_claim', {
      p_fun_token_id: body.tokenId,
      p_creator_wallet: body.creatorWallet,
      p_claimed_eth: body.claimedEth,
      p_tx_hash: body.txHash,
    });

    if (claimError) {
      console.error('Error recording claim:', claimError);
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Base fee claim recorded:', { claimId, tokenId: body.tokenId, eth: body.claimedEth });

    return new Response(
      JSON.stringify({
        success: true,
        claimId,
        message: `Claimed ${body.claimedEth} ETH for token ${body.tokenId}`,
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
