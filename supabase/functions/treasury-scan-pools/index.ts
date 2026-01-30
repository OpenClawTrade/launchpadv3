import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury/deployer wallet that created all the tokens
const DEPLOYER_WALLET = "CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ";

// Meteora DBC Program ID
const DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Meteora API base URL
const METEORA_API_URL = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");

interface PoolData {
  poolAddress: string;
  mintAddress?: string;
  tokenName?: string;
  isRegistered: boolean;
  registeredIn?: string;
  claimableSol?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[treasury-scan-pools] Starting pool discovery at", new Date().toISOString());

  try {
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    
    if (!heliusApiKey) {
      throw new Error("HELIUS_API_KEY not configured");
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

    const registeredMints = new Map<string, { name: string; ticker: string; poolAddress: string | null; table: string }>();
    const registeredPools = new Map<string, { name: string; ticker: string; table: string; mintAddress?: string }>();

    (funTokens || []).forEach((t) => {
      if (t.mint_address) {
        registeredMints.set(t.mint_address, { 
          name: t.name, 
          ticker: t.ticker, 
          poolAddress: t.dbc_pool_address,
          table: "fun_tokens" 
        });
      }
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "fun_tokens",
          mintAddress: t.mint_address,
        });
      }
    });

    (tokens || []).forEach((t) => {
      if (t.mint_address) {
        registeredMints.set(t.mint_address, { 
          name: t.name, 
          ticker: t.ticker, 
          poolAddress: t.dbc_pool_address,
          table: "tokens" 
        });
      }
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "tokens",
          mintAddress: t.mint_address,
        });
      }
    });

    console.log(`[treasury-scan-pools] Found ${registeredMints.size} registered mints, ${registeredPools.size} registered pools`);

    // Step 1: Get all transaction signatures for the deployer wallet
    const allSignatures: string[] = [];
    let beforeSignature: string | undefined = undefined;
    const MAX_PAGES = 50;

    console.log("[treasury-scan-pools] Fetching transaction signatures...");

    for (let page = 0; page < MAX_PAGES; page++) {
      const sigParams: Record<string, unknown> = { limit: 1000 };
      if (beforeSignature) {
        sigParams.before = beforeSignature;
      }

      const sigResponse = await fetch(heliusRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `sigs-${page}`,
          method: "getSignaturesForAddress",
          params: [DEPLOYER_WALLET, sigParams],
        }),
      });

      if (!sigResponse.ok) {
        console.error(`[treasury-scan-pools] getSignaturesForAddress failed`);
        break;
      }

      const sigData = await sigResponse.json();
      const signatures = sigData.result || [];

      if (signatures.length === 0) break;

      for (const sig of signatures) {
        if (sig.signature && !sig.err) {
          allSignatures.push(sig.signature);
        }
      }

      beforeSignature = signatures[signatures.length - 1]?.signature;
      
      if (signatures.length < 1000) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    console.log(`[treasury-scan-pools] Total signatures: ${allSignatures.length}`);

    // Step 2: Parse transactions in batches to find DBC pool creations
    // Look for transactions involving the DBC program
    const allDbcPools = new Set<string>();
    const allMints = new Set<string>();
    const BATCH_SIZE = 20;

    console.log("[treasury-scan-pools] Fetching transactions to find DBC pools...");

    for (let i = 0; i < allSignatures.length; i += BATCH_SIZE) {
      const batch = allSignatures.slice(i, i + BATCH_SIZE);
      
      // Fetch transactions with jsonParsed encoding
      const txPromises = batch.map(async (sig) => {
        try {
          const txResponse = await fetch(heliusRpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: sig,
              method: "getTransaction",
              params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
            }),
          });

          if (!txResponse.ok) return null;
          const txData = await txResponse.json();
          return txData.result;
        } catch {
          return null;
        }
      });

      const txResults = await Promise.all(txPromises);

      for (const tx of txResults) {
        if (!tx?.transaction?.message) continue;

        const accountKeys = tx.transaction.message.accountKeys || [];
        const instructions = tx.transaction.message.instructions || [];
        const innerInstructions = tx.meta?.innerInstructions || [];

        // Check if this transaction involves the DBC program
        const involvesDbc = accountKeys.some((k: { pubkey?: string } | string) => 
          (typeof k === 'string' ? k : k.pubkey) === DBC_PROGRAM_ID
        );

        if (involvesDbc) {
          // Look for DBC pool address in the accounts
          // Pool is typically one of the first accounts in a DBC instruction
          for (const ix of instructions) {
            if (ix.programId === DBC_PROGRAM_ID || (ix.program && ix.program === DBC_PROGRAM_ID)) {
              const accounts = ix.accounts || [];
              // First account is typically the pool
              if (accounts.length > 0) {
                const poolAddr = typeof accounts[0] === 'string' ? accounts[0] : accounts[0]?.pubkey;
                if (poolAddr && poolAddr.length >= 32) {
                  allDbcPools.add(poolAddr);
                }
              }
            }
          }

          // Also check inner instructions
          for (const innerGroup of innerInstructions) {
            for (const innerIx of innerGroup.instructions || []) {
              if (innerIx.programId === DBC_PROGRAM_ID) {
                const accounts = innerIx.accounts || [];
                if (accounts.length > 0) {
                  const poolAddr = typeof accounts[0] === 'string' ? accounts[0] : accounts[0]?.pubkey;
                  if (poolAddr && poolAddr.length >= 32) {
                    allDbcPools.add(poolAddr);
                  }
                }
              }
            }
          }
        }

        // Look for InitializeMint in log messages to find mints
        const logs = tx.meta?.logMessages || [];
        for (const log of logs) {
          if (log.includes("InitializeMint") || log.includes("Initialize the associated token account")) {
            // Check account changes for new accounts
            const postBalances = tx.meta?.postBalances || [];
            const preBalances = tx.meta?.preBalances || [];
            
            for (let idx = 0; idx < accountKeys.length; idx++) {
              // New account = was 0 before, has balance after
              if (preBalances[idx] === 0 && postBalances[idx] > 0) {
                const key = typeof accountKeys[idx] === 'string' ? accountKeys[idx] : accountKeys[idx]?.pubkey;
                if (key && key.length >= 32) {
                  // This could be a mint or token account
                  allMints.add(key);
                }
              }
            }
          }
        }
      }

      // Progress every 200 signatures
      if ((i + BATCH_SIZE) % 200 === 0) {
        console.log(`[treasury-scan-pools] Processed ${i + BATCH_SIZE}/${allSignatures.length}, found ${allDbcPools.size} DBC pools`);
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    // Add registered pools
    for (const poolAddr of registeredPools.keys()) {
      allDbcPools.add(poolAddr);
    }

    console.log(`[treasury-scan-pools] Found ${allDbcPools.size} unique DBC pools`);

    // Step 3: Check each pool for claimable fees
    const discoveredPools: PoolData[] = [];
    const poolAddresses = Array.from(allDbcPools);

    if (METEORA_API_URL && poolAddresses.length > 0) {
      console.log(`[treasury-scan-pools] Checking ${poolAddresses.length} pools for fees...`);
      const FEE_BATCH_SIZE = 5;
      
      for (let i = 0; i < poolAddresses.length; i += FEE_BATCH_SIZE) {
        const batch = poolAddresses.slice(i, i + FEE_BATCH_SIZE);
        
        const batchPromises = batch.map(async (poolAddress) => {
          const regInfo = registeredPools.get(poolAddress);
          
          try {
            const feeResponse = await fetch(
              `${METEORA_API_URL}/api/fees/claim-from-pool?poolAddress=${poolAddress}`,
              { method: "GET", headers: { "Content-Type": "application/json" } }
            );
            
            if (!feeResponse.ok) {
              return {
                poolAddress,
                mintAddress: regInfo?.mintAddress,
                isRegistered: !!regInfo,
                registeredIn: regInfo?.table,
                tokenName: regInfo ? `${regInfo.name} ($${regInfo.ticker})` : undefined,
                claimableSol: 0,
              } as PoolData;
            }
            
            const feeData = await feeResponse.json();
            
            return {
              poolAddress,
              mintAddress: feeData.mintAddress || regInfo?.mintAddress,
              tokenName: regInfo ? `${regInfo.name} ($${regInfo.ticker})` : feeData.tokenName,
              isRegistered: !!regInfo,
              registeredIn: regInfo?.table,
              claimableSol: feeData.claimableSol || 0,
            } as PoolData;
          } catch {
            return {
              poolAddress,
              mintAddress: regInfo?.mintAddress,
              isRegistered: !!regInfo,
              registeredIn: regInfo?.table,
              tokenName: regInfo ? `${regInfo.name} ($${regInfo.ticker})` : undefined,
              claimableSol: 0,
            } as PoolData;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        discoveredPools.push(...batchResults);

        if (i + FEE_BATCH_SIZE < poolAddresses.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } else {
      // Without Meteora API, just list the pools
      for (const poolAddress of poolAddresses) {
        const regInfo = registeredPools.get(poolAddress);
        discoveredPools.push({
          poolAddress,
          mintAddress: regInfo?.mintAddress,
          isRegistered: !!regInfo,
          registeredIn: regInfo?.table,
          tokenName: regInfo ? `${regInfo.name} ($${regInfo.ticker})` : undefined,
        });
      }
    }

    // Filter to pools with claimable fees
    const claimablePools = discoveredPools.filter((p) => (p.claimableSol || 0) >= 0.001);

    // Calculate summary
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
          totalMintsDiscovered: allMints.size,
          totalSignaturesScanned: allSignatures.length,
        },
        pools: claimablePools,
        allPools: discoveredPools,
        allMints: Array.from(allMints).slice(0, 50),
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
