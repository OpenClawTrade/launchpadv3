import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: job, error } = await supabase
      .from("fun_token_jobs")
      .select("id, status, mint_address, dbc_pool_address, fun_token_id, error_message, created_at, completed_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error || !job) {
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build response based on status
    const response: Record<string, unknown> = {
      success: true,
      jobId: job.id,
      status: job.status,
      createdAt: job.created_at,
    };

    if (job.status === "completed") {
      response.mintAddress = job.mint_address;
      response.dbcPoolAddress = job.dbc_pool_address;
      response.tokenId = job.fun_token_id;
      response.completedAt = job.completed_at;
      response.solscanUrl = `https://solscan.io/token/${job.mint_address}`;
      response.tradeUrl = `https://axiom.trade/meme/${job.dbc_pool_address || job.mint_address}`;
      response.message = "🚀 Token launched successfully!";
    } else if (job.status === "failed") {
      response.error = job.error_message;
      response.completedAt = job.completed_at;
    } else if (job.status === "processing" || job.status === "pending") {
      response.message = "Token creation in progress...";
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[fun-create-status] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
