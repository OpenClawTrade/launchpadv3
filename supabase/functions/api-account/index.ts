import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY")!;

// Log API usage
async function logApiUsage(
  supabase: any,
  accountId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number
) {
  try {
    await supabase.from("api_usage_logs").insert({
      api_account_id: accountId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
    });
  } catch (e) {
    console.error("Failed to log API usage:", e);
  }
}

// Generate a secure API key
async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = "ak_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const prefix = key.substring(0, 11); // "ak_" + first 8 chars

  // Hash the key for storage
  const encoder = new TextEncoder();
  const data = encoder.encode(key + API_ENCRYPTION_KEY);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  return { key, hash, prefix };
}

// Hash an API key for verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key + API_ENCRYPTION_KEY);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // POST: Create new API account or regenerate key
    if (req.method === "POST") {
      const body = await req.json();
      const { walletAddress, feeWalletAddress, signature, action: bodyAction } = body;

      if (!walletAddress) {
        return new Response(JSON.stringify({ error: "walletAddress is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if account already exists
      const { data: existing } = await supabase.rpc("get_api_account_by_wallet", {
        p_wallet_address: walletAddress,
      });

      if (existing && existing.length > 0 && bodyAction !== "regenerate") {
        return new Response(JSON.stringify({ 
          error: "Account already exists",
          account: existing[0],
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate new API key
      const { key, hash, prefix } = await generateApiKey();

      if (bodyAction === "regenerate" && existing && existing.length > 0) {
        // Update existing account with new key
        const { error: updateError } = await supabase
          .from("api_accounts")
          .update({
            api_key_hash: hash,
            api_key_prefix: prefix,
            updated_at: new Date().toISOString(),
          })
          .eq("wallet_address", walletAddress);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({
          success: true,
          apiKey: key, // Only returned once!
          prefix,
          message: "API key regenerated. Store it securely - it won't be shown again.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new account using SECURITY DEFINER function
      const { data: accountId, error: createError } = await supabase.rpc("backend_create_api_account", {
        p_wallet_address: walletAddress,
        p_api_key_hash: hash,
        p_api_key_prefix: prefix,
        p_fee_wallet_address: feeWalletAddress || walletAddress,
      });

      if (createError) throw createError;

      return new Response(JSON.stringify({
        success: true,
        accountId,
        apiKey: key, // Only returned once!
        prefix,
        message: "API account created. Store your API key securely - it won't be shown again.",
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Get account info by wallet
    if (req.method === "GET") {
      const walletAddress = url.searchParams.get("wallet");

      if (!walletAddress) {
        return new Response(JSON.stringify({ error: "wallet parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.rpc("get_api_account_by_wallet", {
        p_wallet_address: walletAddress,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ exists: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        exists: true,
        account: data[0],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Verify API key
    if (req.method === "PUT") {
      const body = await req.json();
      const { apiKey } = body;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "apiKey is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hash = await hashApiKey(apiKey);
      const { data, error } = await supabase.rpc("verify_api_key", {
        p_api_key_hash: hash,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        valid: true,
        accountId: data[0].id,
        walletAddress: data[0].wallet_address,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("API Account error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
