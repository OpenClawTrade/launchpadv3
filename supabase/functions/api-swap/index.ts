import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface QuoteRequest {
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1] || "quote";

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify API key using RPC
    const { data: verifyData, error: verifyError } = await supabase.rpc("verify_api_key", {
      p_api_key: apiKey,
    });

    if (verifyError || !verifyData?.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiAccountId = verifyData.account_id as string;

    if (action === "quote" && req.method === "POST") {
      return await handleQuote(req, supabase, apiAccountId);
    } else if (action === "pools" && req.method === "GET") {
      return await handleListPools(supabase, apiAccountId);
    } else if (action === "pool" && req.method === "GET") {
      const poolAddress = url.searchParams.get("address");
      if (!poolAddress) {
        return new Response(
          JSON.stringify({ error: "Missing pool address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await handleGetPool(supabase, poolAddress, apiAccountId);
    } else {
      return new Response(
        JSON.stringify({ 
          error: "Invalid action",
          availableActions: [
            "POST /api-swap (or /api-swap/quote) - Get swap quote",
            "GET /api-swap/pools - List available pools",
            "GET /api-swap/pool?address=xxx - Get pool info"
          ]
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[api-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function handleQuote(
  req: Request,
  supabase: any,
  apiAccountId: string
) {
  const body: QuoteRequest = await req.json();

  // Validate required fields
  if (!body.poolAddress || !body.amount) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: poolAddress, amount" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get pool info from database
  const { data: token, error: tokenError } = await supabase
    .from("tokens")
    .select("*")
    .eq("dbc_pool_address", body.poolAddress)
    .single();

  if (tokenError || !token) {
    return new Response(
      JSON.stringify({ error: "Pool not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const isBuy = body.inputMint === SOL_MINT;
  const inputAmount = parseFloat(body.amount);
  const slippageBps = body.slippageBps || 100; // 1% default

  // Calculate output using constant product formula
  const virtualSol = token.virtual_sol_reserves || 30;
  const virtualToken = token.virtual_token_reserves || 1000000000;
  const feeBps = token.system_fee_bps || 200; // 2% fee

  let outputAmount: number;
  let priceImpact: number;
  let feeAmount: number;

  if (isBuy) {
    // SOL -> Token
    const solIn = inputAmount / 1e9; // Convert lamports to SOL
    feeAmount = solIn * (feeBps / 10000);
    const solAfterFee = solIn - feeAmount;
    
    const k = virtualSol * virtualToken;
    const newSolReserves = virtualSol + solAfterFee;
    const newTokenReserves = k / newSolReserves;
    outputAmount = virtualToken - newTokenReserves;
    
    const expectedPrice = virtualSol / virtualToken;
    const actualPrice = solAfterFee / outputAmount;
    priceImpact = ((actualPrice - expectedPrice) / expectedPrice) * 100;
  } else {
    // Token -> SOL
    const tokenIn = inputAmount / 1e9; // Convert to token units
    const k = virtualSol * virtualToken;
    const newTokenReserves = virtualToken + tokenIn;
    const newSolReserves = k / newTokenReserves;
    const solOut = virtualSol - newSolReserves;
    
    feeAmount = solOut * (feeBps / 10000);
    outputAmount = (solOut - feeAmount) * 1e9; // Convert back to lamports
    
    const expectedPrice = virtualToken / virtualSol;
    const actualPrice = tokenIn / (solOut - feeAmount);
    priceImpact = ((actualPrice - expectedPrice) / expectedPrice) * 100;
  }

  // Apply slippage tolerance
  const minOutput = outputAmount * (1 - slippageBps / 10000);

  // Log API usage
  await supabase.from("api_usage_logs").insert({
    api_account_id: apiAccountId,
    endpoint: "/api-swap/quote",
    method: "POST",
    status_code: 200,
  });

  return new Response(
    JSON.stringify({
      success: true,
      inputMint: body.inputMint,
      outputMint: body.outputMint || token.mint_address,
      inputAmount: body.amount,
      outputAmount: Math.floor(outputAmount).toString(),
      minOutputAmount: Math.floor(minOutput).toString(),
      priceImpact: Math.abs(priceImpact).toFixed(4),
      fee: {
        bps: feeBps,
        amount: isBuy ? Math.floor(feeAmount * 1e9).toString() : Math.floor(feeAmount * 1e9).toString(),
      },
      poolInfo: {
        mintAddress: token.mint_address,
        poolAddress: token.dbc_pool_address,
        name: token.name,
        ticker: token.ticker,
        price: token.price_sol,
        virtualSolReserves: virtualSol,
        virtualTokenReserves: virtualToken,
      },
      note: "To execute this swap, use the Meteora DBC SDK or send the transaction to the pool directly.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleListPools(
  supabase: any,
  apiAccountId: string
) {
  // Get all active tokens with pools
  const { data: tokens, error } = await supabase
    .from("tokens")
    .select("mint_address, name, ticker, dbc_pool_address, price_sol, market_cap_sol, volume_24h_sol, status")
    .not("dbc_pool_address", "is", null)
    .eq("status", "bonding")
    .order("market_cap_sol", { ascending: false })
    .limit(100);

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch pools" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log API usage
  await supabase.from("api_usage_logs").insert({
    api_account_id: apiAccountId,
    endpoint: "/api-swap/pools",
    method: "GET",
    status_code: 200,
  });

  // deno-lint-ignore no-explicit-any
  const pools = tokens?.map((t: any) => ({
    mintAddress: t.mint_address,
    poolAddress: t.dbc_pool_address,
    name: t.name,
    ticker: t.ticker,
    price: t.price_sol,
    marketCap: t.market_cap_sol,
    volume24h: t.volume_24h_sol,
    status: t.status,
  })) || [];

  return new Response(
    JSON.stringify({
      success: true,
      count: tokens?.length || 0,
      pools,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// deno-lint-ignore no-explicit-any
async function handleGetPool(
  supabase: any,
  poolAddress: string,
  apiAccountId: string
) {
  const { data: token, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("dbc_pool_address", poolAddress)
    .single();

  if (error || !token) {
    return new Response(
      JSON.stringify({ error: "Pool not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Log API usage
  await supabase.from("api_usage_logs").insert({
    api_account_id: apiAccountId,
    endpoint: "/api-swap/pool",
    method: "GET",
    status_code: 200,
  });

  return new Response(
    JSON.stringify({
      success: true,
      pool: {
        mintAddress: token.mint_address,
        poolAddress: token.dbc_pool_address,
        name: token.name,
        ticker: token.ticker,
        description: token.description,
        imageUrl: token.image_url,
        price: token.price_sol,
        marketCap: token.market_cap_sol,
        volume24h: token.volume_24h_sol,
        virtualSolReserves: token.virtual_sol_reserves,
        virtualTokenReserves: token.virtual_token_reserves,
        totalSupply: token.total_supply,
        bondingProgress: token.bonding_curve_progress,
        graduationThreshold: token.graduation_threshold_sol,
        status: token.status,
        createdAt: token.created_at,
        websiteUrl: token.website_url,
        twitterUrl: token.twitter_url,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
