import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLOSSEUM_API_BASE = "https://agents.colosseum.com/api";

interface ColosseumRegistration {
  agentId: string;
  apiKey: string;
  claimCode: string;
}

interface HeartbeatResponse {
  status: string;
  pendingActions: string[];
  leaderboardRank?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const colosseumApiKey = Deno.env.get("COLOSSEUM_API_KEY");

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    // Log activity
    const logActivity = async (type: string, payload: unknown, response: unknown, success: boolean, error?: string) => {
      await supabase.from("colosseum_activity").insert({
        activity_type: type,
        payload,
        response,
        success,
        error_message: error,
      });
    };

    switch (action) {
      case "register": {
        // Register TUNA agent on Colosseum
        console.log("[colosseum-bridge] Registering agent...");
        
        const registrationPayload = {
          name: "tuna-agent-sdk",
          description: "Infrastructure for AI agents to launch tokens, build communities, and earn 80% of trading fees on Solana. Production-ready with 22+ tokens launched.",
          capabilities: [
            "token_launch",
            "community_management", 
            "fee_distribution",
            "voice_fingerprinting",
            "autonomous_posting"
          ],
          solanaIntegration: true,
          liveUrl: "https://clawmode.fun",
          apiDocsUrl: "https://clawmode.fun/agents/docs",
          skillFileUrl: "https://clawmode.fun/skill.md"
        };

        try {
          const response = await fetch(`${COLOSSEUM_API_BASE}/agents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(colosseumApiKey ? { "Authorization": `Bearer ${colosseumApiKey}` } : {}),
            },
            body: JSON.stringify(registrationPayload),
          });

          const data = await response.json();
          
          if (response.ok && data.agentId) {
            // Store registration (encrypt API key in production)
            await supabase.from("colosseum_registrations").upsert({
              agent_id: data.agentId,
              agent_name: "tuna-agent-sdk",
              api_key_encrypted: data.apiKey || "pending",
              claim_code: data.claimCode || "",
            });

            await logActivity("register", registrationPayload, data, true);
            
            return new Response(JSON.stringify({
              success: true,
              agentId: data.agentId,
              claimCode: data.claimCode,
              message: "TUNA agent registered successfully on Colosseum"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            await logActivity("register", registrationPayload, data, false, data.error || "Registration failed");
            throw new Error(data.error || "Registration failed");
          }
        } catch (fetchError) {
          // Colosseum API might not be live yet - log and return pending status
          console.log("[colosseum-bridge] Colosseum API not available:", fetchError);
          await logActivity("register", registrationPayload, null, false, String(fetchError));
          
          return new Response(JSON.stringify({
            success: false,
            pending: true,
            message: "Colosseum API not yet available. Registration queued.",
            payload: registrationPayload
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "heartbeat": {
        // Sync with Colosseum heartbeat
        console.log("[colosseum-bridge] Sending heartbeat...");
        
        // Get our registration
        const { data: registration } = await supabase
          .from("colosseum_registrations")
          .select("*")
          .single();

        if (!registration) {
          return new Response(JSON.stringify({
            success: false,
            error: "Not registered on Colosseum yet"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get TUNA stats for heartbeat
        const { data: tokenStats } = await supabase
          .from("fun_tokens")
          .select("id, chain")
          .eq("chain", "solana");
        
        const { data: feeStats } = await supabase.rpc("get_fun_fee_claims_summary");
        const { data: agentStats } = await supabase
          .from("agents")
          .select("id")
          .eq("status", "active");

        const heartbeatPayload = {
          agentId: registration.agent_id,
          stats: {
            tokensLaunched: tokenStats?.length || 0,
            activeAgents: agentStats?.length || 0,
            totalFeesClaimed: feeStats?.[0]?.total_claimed_sol || 0,
            lastActivity: new Date().toISOString()
          },
          capabilities: {
            canLaunchTokens: true,
            canPostToForum: true,
            canEngageOthers: true
          }
        };

        try {
          const response = await fetch(`${COLOSSEUM_API_BASE}/heartbeat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${registration.api_key_encrypted}`,
            },
            body: JSON.stringify(heartbeatPayload),
          });

          const data = await response.json();
          await logActivity("heartbeat", heartbeatPayload, data, response.ok);

          return new Response(JSON.stringify({
            success: response.ok,
            stats: heartbeatPayload.stats,
            response: data
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (fetchError) {
          console.log("[colosseum-bridge] Heartbeat failed:", fetchError);
          await logActivity("heartbeat", heartbeatPayload, null, false, String(fetchError));
          
          return new Response(JSON.stringify({
            success: false,
            stats: heartbeatPayload.stats,
            message: "Heartbeat queued - Colosseum API not available"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "status": {
        // Get current Colosseum participation status
        const { data: registration } = await supabase
          .from("colosseum_registrations")
          .select("*")
          .single();

        const { data: recentActivity } = await supabase
          .from("colosseum_activity")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: forumPosts } = await supabase
          .from("colosseum_forum_posts")
          .select("*")
          .order("posted_at", { ascending: false });

        const { data: comments } = await supabase
          .from("colosseum_forum_comments")
          .select("*")
          .order("posted_at", { ascending: false });

        return new Response(JSON.stringify({
          registered: !!registration,
          registration: registration ? {
            agentId: registration.agent_id,
            agentName: registration.agent_name,
            registeredAt: registration.registered_at,
          } : null,
          stats: {
            forumPosts: forumPosts?.length || 0,
            comments: comments?.length || 0,
            recentActivityCount: recentActivity?.length || 0
          },
          recentActivity: recentActivity?.slice(0, 5) || []
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: "Invalid action. Use: register, heartbeat, status"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[colosseum-bridge] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
