import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PumpFunTokenData {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  market_cap?: number;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
  usd_market_cap?: number;
  total_supply?: number;
  creator?: string;
  created_timestamp?: number;
  raydium_pool?: string;
  complete?: boolean;
  holder_count?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress, syncAll } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If syncAll is true, fetch all pumpfun tokens and update them
    if (syncAll) {
      const { data: pumpTokens, error: fetchError } = await supabase
        .from("fun_tokens")
        .select("id, mint_address")
        .eq("launchpad_type", "pumpfun")
        .eq("status", "active")
        .not("mint_address", "is", null);

      if (fetchError) throw fetchError;

      const results = [];
      for (const token of pumpTokens || []) {
        try {
          const data = await fetchPumpFunData(token.mint_address);
          if (data) {
            await updateTokenData(supabase, token.id, data);
            results.push({ mint: token.mint_address, success: true });
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Failed to sync ${token.mint_address}:`, err);
          results.push({ mint: token.mint_address, success: false, error: errorMsg });
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single token lookup
    if (!mintAddress) {
      return new Response(
        JSON.stringify({ error: "mintAddress required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await fetchPumpFunData(mintAddress);
    
    if (!data) {
      return new Response(
        JSON.stringify({ error: "Token not found on pump.fun" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update in database if we have this token
    const { data: existingToken } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .eq("launchpad_type", "pumpfun")
      .single();

    if (existingToken) {
      await updateTokenData(supabase, existingToken.id, data);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("pumpfun-data error:", error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchPumpFunData(mintAddress: string): Promise<PumpFunTokenData | null> {
  try {
    // pump.fun API endpoint for token data
    const response = await fetch(`https://frontend-api.pump.fun/coins/${mintAddress}`);
    
    if (!response.ok) {
      console.log(`pump.fun API returned ${response.status} for ${mintAddress}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`Failed to fetch pump.fun data for ${mintAddress}:`, err);
    return null;
  }
}

async function updateTokenData(supabase: any, tokenId: string, data: PumpFunTokenData) {
  // Calculate holder count from API or default
  const holderCount = data.holder_count || 0;
  
  // Calculate market cap in SOL (pump.fun gives USD market cap)
  // We'll store both
  const marketCapSol = data.virtual_sol_reserves || 0;
  const marketCapUsd = data.usd_market_cap || 0;
  
  // Calculate price in SOL
  const priceSol = data.virtual_sol_reserves && data.virtual_token_reserves
    ? data.virtual_sol_reserves / data.virtual_token_reserves
    : 0;

  // Check if token is graduated (migrated to Raydium)
  const isGraduated = data.complete || !!data.raydium_pool;

  const { error } = await supabase
    .from("fun_tokens")
    .update({
      holder_count: holderCount,
      market_cap_sol: marketCapSol,
      price_sol: priceSol,
      status: isGraduated ? "graduated" : "active",
      raydium_pool: data.raydium_pool || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);

  if (error) {
    console.error(`Failed to update token ${tokenId}:`, error);
    throw error;
  }
}
