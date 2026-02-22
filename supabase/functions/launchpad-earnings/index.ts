import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Convert Privy DID to deterministic UUID via SHA-1 (matches frontend auth logic)
async function privyDidToUuid(did: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(did);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = new Uint8Array(hashBuffer);
  const hex = Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");
  // Format as UUID v5-style: 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");
    const profileId = url.searchParams.get("profileId");

    console.log("[launchpad-earnings] Request:", { walletAddress, profileId });

    if (!walletAddress && !profileId) {
      return new Response(
        JSON.stringify({ error: "Missing wallet or profileId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query for fee earners
    let query = supabase
      .from("fee_earners")
      .select(`
        *,
        tokens (
          id,
          name,
          ticker,
          image_url,
          mint_address,
          status,
          volume_24h_sol
        )
      `);

    if (profileId) {
      const uuid = await privyDidToUuid(profileId);
      query = query.eq("profile_id", uuid);
    } else if (walletAddress) {
      query = query.eq("wallet_address", walletAddress);
    }

    const { data: earnings, error } = await query.order("total_earned_sol", { ascending: false });

    if (error) {
      console.error("[launchpad-earnings] Query error:", error);
      throw error;
    }

    // Calculate totals
    const totalEarned = earnings?.reduce((sum, e) => sum + (e.total_earned_sol || 0), 0) || 0;
    const totalUnclaimed = earnings?.reduce((sum, e) => sum + (e.unclaimed_sol || 0), 0) || 0;

    // Get claim history
    const earnerIds = earnings?.map(e => e.id) || [];
    let claims: any[] = [];
    
    if (earnerIds.length > 0) {
      const { data: claimData } = await supabase
        .from("fee_claims")
        .select("*")
        .in("fee_earner_id", earnerIds)
        .order("created_at", { ascending: false })
        .limit(50);
      
      claims = claimData || [];
    }

    console.log("[launchpad-earnings] Found:", { 
      earningsCount: earnings?.length || 0, 
      totalEarned, 
      totalUnclaimed 
    });

    return new Response(
      JSON.stringify({
        earnings: earnings || [],
        claims,
        summary: {
          totalEarned,
          totalUnclaimed,
          tokensWithEarnings: earnings?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[launchpad-earnings] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
