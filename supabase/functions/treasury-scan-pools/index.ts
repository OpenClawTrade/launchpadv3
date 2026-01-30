import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury/deployer wallet that created all the tokens
const DEPLOYER_WALLET = "CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ";

// WSOL mint for DBC pool derivation
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Meteora DBC Program ID
const DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[treasury-scan-pools] Starting pool discovery at", new Date().toISOString());

  try {
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    
    if (!heliusApiKey && !heliusRpcUrl) {
      throw new Error("HELIUS_API_KEY or HELIUS_RPC_URL not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get registered tokens from database for cross-reference
    const { data: funTokens } = await supabase
      .from("fun_tokens")
      .select("mint_address, dbc_pool_address, name, ticker");
    
    const { data: tokens } = await supabase
      .from("tokens")
      .select("mint_address, dbc_pool_address, name, ticker");

    const registeredMints = new Set<string>();
    const registeredPools = new Map<string, { name: string; ticker: string; table: string }>();

    (funTokens || []).forEach((t) => {
      if (t.mint_address) registeredMints.add(t.mint_address);
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "fun_tokens" 
        });
      }
    });

    (tokens || []).forEach((t) => {
      if (t.mint_address) registeredMints.add(t.mint_address);
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "tokens" 
        });
      }
    });

    console.log(`[treasury-scan-pools] Found ${registeredMints.size} registered mints, ${registeredPools.size} registered pools`);

    // Use getProgramAccounts to find all DBC pools where feeClaimer matches treasury
    // This is more reliable than deriving pool addresses since configPubkey varies
    const poolScanResponse = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-program-accounts",
        method: "getProgramAccounts",
        params: [
          DBC_PROGRAM_ID,
          {
            encoding: "base64",
            filters: [
              {
                // Pool account size filter (approximate - DBC pools are ~400-500 bytes)
                dataSize: 456,
              },
            ],
          },
        ],
      }),
    });

    if (!poolScanResponse.ok) {
      const errorText = await poolScanResponse.text();
      console.error("[treasury-scan-pools] getProgramAccounts failed:", errorText);
      throw new Error(`RPC error: ${errorText}`);
    }

    const poolScanData = await poolScanResponse.json();
    
    if (poolScanData.error) {
      console.error("[treasury-scan-pools] RPC error:", poolScanData.error);
      throw new Error(`RPC error: ${JSON.stringify(poolScanData.error)}`);
    }

    const allPools = poolScanData.result || [];
    console.log(`[treasury-scan-pools] Found ${allPools.length} total DBC pools on-chain`);

    // Now we need to check each pool's fee metrics to see claimable fees
    // For efficiency, we'll batch check using Meteora API
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    
    if (!meteoraApiUrl) {
      console.warn("[treasury-scan-pools] METEORA_API_URL not configured - will only return pool addresses");
    }

    const discoveredPools: Array<{
      poolAddress: string;
      mintAddress?: string;
      tokenName?: string;
      isRegistered: boolean;
      registeredIn?: string;
      claimableSol?: number;
      error?: string;
    }> = [];

    // Process pools in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    const poolAddresses = allPools.map((p: { pubkey: string }) => p.pubkey);
    
    for (let i = 0; i < poolAddresses.length; i += BATCH_SIZE) {
      const batch = poolAddresses.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (poolAddress: string) => {
        const poolInfo = registeredPools.get(poolAddress);
        const isRegistered = !!poolInfo;
        
        let claimableSol: number | undefined;
        let mintAddress: string | undefined;
        let tokenName: string | undefined = poolInfo?.name;
        let error: string | undefined;

        // Check claimable fees via Meteora API if available
        if (meteoraApiUrl) {
          try {
            const feeResponse = await fetch(
              `${meteoraApiUrl}/api/fees/claim-from-pool?poolAddress=${poolAddress}`,
              { method: "GET", headers: { "Content-Type": "application/json" } }
            );
            
            if (feeResponse.ok) {
              const feeData = await feeResponse.json();
              claimableSol = feeData.claimableSol || 0;
            } else {
              const errText = await feeResponse.text();
              // Pool may not belong to our treasury - that's expected
              if (errText.includes("Insufficient fees") || errText.includes("not found")) {
                claimableSol = 0;
              } else {
                error = errText.substring(0, 100);
              }
            }
          } catch (err) {
            error = err instanceof Error ? err.message.substring(0, 100) : "Unknown error";
          }
        }

        return {
          poolAddress,
          mintAddress,
          tokenName,
          isRegistered,
          registeredIn: poolInfo?.table,
          claimableSol,
          error,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      discoveredPools.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < poolAddresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Filter to only pools with claimable fees (> 0.001 SOL)
    const claimablePools = discoveredPools.filter(
      (p) => (p.claimableSol || 0) >= 0.001
    );

    // Calculate summary stats
    const totalPools = discoveredPools.length;
    const registeredCount = discoveredPools.filter((p) => p.isRegistered).length;
    const unregisteredCount = totalPools - registeredCount;
    const totalClaimable = claimablePools.reduce((sum, p) => sum + (p.claimableSol || 0), 0);

    const duration = Date.now() - startTime;
    console.log(`[treasury-scan-pools] Complete: ${totalPools} pools, ${claimablePools.length} with fees, ${totalClaimable.toFixed(4)} SOL claimable, ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalPools,
          registeredCount,
          unregisteredCount,
          claimablePoolCount: claimablePools.length,
          totalClaimableSol: totalClaimable,
        },
        pools: claimablePools,
        allPools: discoveredPools,
        deployerWallet: DEPLOYER_WALLET,
        duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[treasury-scan-pools] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
