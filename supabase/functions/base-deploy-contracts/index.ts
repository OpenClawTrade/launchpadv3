import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from "https://esm.sh/viem@2.45.1";
import { base, baseSepolia } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// Base Deploy Contracts - Health Check & Balance Verification
// 
// This function serves as the admin panel's deployment readiness checker.
// Actual token deployment is handled by base-create-token.
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { network = "mainnet", dryRun = true } = body;

    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "BASE_DEPLOYER_PRIVATE_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chain = network === "mainnet" ? base : baseSepolia;
    const rpcUrl =
      network === "mainnet"
        ? "https://mainnet.base.org"
        : "https://sepolia.base.org";

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x")
        ? deployerKey
        : `0x${deployerKey}`) as `0x${string}`
    );

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // Check deployer balance
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    const balanceEth = formatEther(balance);
    const minBalance = parseEther("0.005");

    if (balance < minBalance) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          deployer: account.address,
          balance: `${balanceEth} ETH`,
          required: "0.005 ETH minimum",
          message: `Fund ${account.address} with at least 0.005 ETH on Base ${network}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get nonce to verify the account is accessible
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          deployer: account.address,
          balance: `${balanceEth} ETH`,
          nonce,
          network,
          chain: chain.name,
          ready: true,
          message:
            "Deployer wallet is funded and ready. Tokens are deployed on-demand via the launch form.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Non-dry-run: record readiness status in base_deployments
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Deactivate previous deployments for this network
    await supabase
      .from("base_deployments")
      .update({ is_active: false })
      .eq("network", network)
      .eq("is_active", true);

    // Record new deployment readiness
    await supabase.from("base_deployments").insert({
      network,
      deployer: account.address,
      contracts: {
        type: "on-demand-deployer",
        deployer: account.address,
        balance: balanceEth,
        nonce,
      },
      tx_hashes: [`nonce-${nonce}`],
      deployed_at: new Date().toISOString(),
      is_active: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        network,
        deployer: account.address,
        balance: `${balanceEth} ETH`,
        nonce,
        message: `Base ${network} deployer configured. Tokens deploy on-demand when users launch.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Deploy] Error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Health check failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
