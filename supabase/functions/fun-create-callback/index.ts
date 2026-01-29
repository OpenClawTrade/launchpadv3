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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobId, success, mintAddress, dbcPoolAddress, error } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing jobId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-create-callback] Processing callback for job:", jobId, { success, mintAddress });

    // Get the job details
    const { data: job, error: fetchError } = await supabase
      .from("fun_token_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (fetchError || !job) {
      console.error("[fun-create-callback] Job not found:", jobId);
      return new Response(
        JSON.stringify({ success: false, error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already completed, never process again.
    if (job.status === "completed") {
      console.log("[fun-create-callback] Job already processed:", job.status);
      return new Response(
        JSON.stringify({ success: true, message: "Job already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IMPORTANT:
    // Jobs can be marked "failed" due to client/server timeouts even if the on-chain
    // creation actually succeeds later. If we receive a SUCCESS callback for a job
    // currently marked failed, we should still finalize it.
    if (job.status === "failed" && !success) {
      console.log("[fun-create-callback] Job already failed; ignoring failure callback");
      return new Response(
        JSON.stringify({ success: true, message: "Job already failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status === "failed" && success) {
      console.log("[fun-create-callback] ⚠️ Recovering previously failed job via success callback", {
        jobId,
        previousError: job.error_message,
        mintAddress,
      });
    }

    if (!success) {
      // Mark job as failed
      await supabase.rpc("backend_fail_token_job", {
        p_job_id: jobId,
        p_error_message: error || "Unknown error during on-chain creation",
      });

      console.log("[fun-create-callback] ❌ Job failed:", error);
      return new Response(
        JSON.stringify({ success: true, message: "Job marked as failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: if we already created the token row for this mint, reuse it.
    let funTokenId: string | null = null;
    if (mintAddress) {
      const { data: existingToken, error: existingErr } = await supabase
        .from("fun_tokens")
        .select("id")
        .eq("mint_address", mintAddress)
        .maybeSingle();

      if (existingErr) {
        console.warn("[fun-create-callback] Existing token lookup failed; continuing", existingErr);
      }

      if (existingToken?.id) {
        funTokenId = existingToken.id;
      }
    }

    if (!funTokenId) {
      // Insert into fun_tokens table
      const { data: funToken, error: insertError } = await supabase
        .from("fun_tokens")
        .insert({
          name: job.name.slice(0, 50),
          ticker: job.ticker.toUpperCase().slice(0, 5),
          description: job.description?.slice(0, 500) || null,
          image_url: job.image_url || null,
          creator_wallet: job.creator_wallet,
          mint_address: mintAddress,
          dbc_pool_address: dbcPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: job.website_url || null,
          twitter_url: job.twitter_url || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[fun-create-callback] ❌ Insert error:", insertError);
        await supabase.rpc("backend_fail_token_job", {
          p_job_id: jobId,
          p_error_message: "Failed to create token record: " + insertError.message,
        });
        throw new Error("Failed to create token record");
      }

      funTokenId = funToken.id;
    }

    // Mark job as completed
    await supabase.rpc("backend_complete_token_job", {
      p_job_id: jobId,
      p_mint_address: mintAddress,
      p_dbc_pool_address: dbcPoolAddress,
      p_fun_token_id: funTokenId,
    });

    console.log("[fun-create-callback] ✅ Token created successfully:", {
      id: funTokenId,
      mintAddress,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: funTokenId,
        mintAddress,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[fun-create-callback] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
