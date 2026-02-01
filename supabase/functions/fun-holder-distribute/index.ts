import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Distribution parameters - safety first
const TOTAL_SUPPLY = 1_000_000_000;
const MIN_BALANCE_PERCENT = 0.003; // 0.3% of supply required to qualify
const MIN_BALANCE = TOTAL_SUPPLY * MIN_BALANCE_PERCENT; // 3,000,000 tokens
const MIN_POOL_SOL = 0.05; // Minimum pool before distribution
const MIN_PAYOUT_SOL = 0.001; // Minimum payout per holder
const MAX_HOLDERS = 50; // Maximum holders to pay
const MAX_TRANSFERS_PER_TX = 20; // Batch size for transactions
const LOCK_NAME = "fun-holder-distribute-lock";
const LOCK_DURATION_SECONDS = 180; // 3 minutes lock

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[fun-holder-distribute] ⏰ Starting holder fee distribution...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get treasury keypair for sending payments
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Parse treasury keypair
    let treasuryKeypair: Keypair;
    try {
      if (treasuryPrivateKey.startsWith("[")) {
        const keyArray = JSON.parse(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        const decoded = bs58.decode(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(decoded);
      }
    } catch (e) {
      throw new Error("Invalid TREASURY_PRIVATE_KEY format");
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // ===== STEP 1: Acquire lock to prevent concurrent runs =====
    const lockExpiry = new Date(Date.now() + LOCK_DURATION_SECONDS * 1000).toISOString();
    
    // Try to acquire lock
    const { error: lockError } = await supabase
      .from("cron_locks")
      .upsert({
        lock_name: LOCK_NAME,
        acquired_at: new Date().toISOString(),
        expires_at: lockExpiry,
      }, { onConflict: "lock_name" });

    // Check if lock is held by another process
    const { data: existingLock } = await supabase
      .from("cron_locks")
      .select("*")
      .eq("lock_name", LOCK_NAME)
      .single();

    if (existingLock && new Date(existingLock.expires_at) > new Date()) {
      // Lock is still valid from another run
      const timeSinceAcquired = Date.now() - new Date(existingLock.acquired_at).getTime();
      if (timeSinceAcquired > 5000) { // If lock was acquired > 5s ago, another process has it
        console.log("[fun-holder-distribute] ⏳ Another distribution is running, skipping...");
        return new Response(
          JSON.stringify({ success: true, message: "Skipped - another run in progress" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== STEP 2: Check treasury balance =====
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;
    console.log(`[fun-holder-distribute] Treasury balance: ${treasuryBalanceSol.toFixed(4)} SOL`);

    if (treasuryBalanceSol < 0.01) {
      console.warn("[fun-holder-distribute] ⚠️ Treasury balance too low");
      return new Response(
        JSON.stringify({ success: true, message: "Treasury balance too low" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 3: Find tokens with holder_rewards mode and sufficient pool =====
    const { data: readyPools, error: poolsError } = await supabase
      .from("holder_reward_pool")
      .select(`
        *,
        fun_token:fun_tokens(id, name, ticker, mint_address, status, fee_mode)
      `)
      .gte("accumulated_sol", MIN_POOL_SOL);

    if (poolsError) {
      throw new Error(`Failed to fetch pools: ${poolsError.message}`);
    }

    // Filter to only holder_rewards tokens that are active
    const eligiblePools = (readyPools || []).filter(pool => 
      pool.fun_token?.fee_mode === 'holder_rewards' && 
      pool.fun_token?.status === 'active'
    );

    console.log(`[fun-holder-distribute] Found ${eligiblePools.length} eligible pools`);

    if (eligiblePools.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No eligible pools", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let totalDistributed = 0;
    let successCount = 0;
    let failureCount = 0;

    // ===== STEP 4: Process each eligible pool =====
    for (const pool of eligiblePools) {
      const token = pool.fun_token;
      const poolSol = Number(pool.accumulated_sol);

      console.log(`[fun-holder-distribute] Processing ${token.ticker}: ${poolSol.toFixed(4)} SOL`);

      // STEP 4.1: Create LOCKED snapshot first (immutable)
      const { data: snapshot, error: snapshotError } = await supabase
        .from("holder_reward_snapshots")
        .insert({
          fun_token_id: token.id,
          pool_sol: poolSol,
          min_balance_required: MIN_BALANCE,
          qualified_holders: 0,
          status: "locked",
        })
        .select()
        .single();

      if (snapshotError) {
        console.error(`[fun-holder-distribute] Failed to create snapshot:`, snapshotError);
        failureCount++;
        continue;
      }

      try {
        // STEP 4.2: Fetch top holders via Helius
        const holders = await fetchTopHolders(heliusRpcUrl, token.mint_address, MAX_HOLDERS);
        
        // STEP 4.3: Filter by minimum balance (0.3% = 3M tokens)
        const qualified = holders.filter(h => h.balance >= MIN_BALANCE);

        console.log(`[fun-holder-distribute] ${token.ticker}: ${holders.length} holders, ${qualified.length} qualified`);

        if (qualified.length === 0) {
          // Update snapshot as failed
          await supabase
            .from("holder_reward_snapshots")
            .update({ 
              status: "failed", 
              error_message: "No qualified holders (min 0.3% balance required)",
              completed_at: new Date().toISOString()
            })
            .eq("id", snapshot.id);
          
          results.push({
            token: token.ticker,
            status: "no_qualified_holders",
            holdersFound: holders.length,
            poolSol,
          });
          continue;
        }

        // STEP 4.4: Calculate proportional payouts
        const totalBalance = qualified.reduce((sum, h) => sum + h.balance, 0);
        const payouts = qualified.map(h => ({
          wallet: h.address,
          balance: h.balance,
          share: h.balance / totalBalance,
          payout: (h.balance / totalBalance) * poolSol,
        }));

        // STEP 4.5: Filter out sub-minimum payouts
        const validPayouts = payouts.filter(p => p.payout >= MIN_PAYOUT_SOL);
        const skippedAmount = payouts
          .filter(p => p.payout < MIN_PAYOUT_SOL)
          .reduce((sum, p) => sum + p.payout, 0);

        console.log(`[fun-holder-distribute] ${token.ticker}: ${validPayouts.length} valid payouts, ${skippedAmount.toFixed(4)} SOL skipped`);

        // Update snapshot with qualified count
        await supabase
          .from("holder_reward_snapshots")
          .update({ 
            status: "distributing",
            qualified_holders: validPayouts.length 
          })
          .eq("id", snapshot.id);

        // STEP 4.6: Create payout records BEFORE sending
        for (const payout of validPayouts) {
          await supabase
            .from("holder_reward_payouts")
            .insert({
              snapshot_id: snapshot.id,
              fun_token_id: token.id,
              wallet_address: payout.wallet,
              token_balance: payout.balance,
              balance_share: payout.share,
              payout_sol: payout.payout,
              status: "pending",
            });
        }

        // STEP 4.7: Execute batched transfers
        const batches = chunk(validPayouts, MAX_TRANSFERS_PER_TX);
        let distributedInThisPool = 0;

        for (const batch of batches) {
          try {
            const signature = await sendBatchTransfer(
              connection,
              treasuryKeypair,
              batch.map(p => ({ wallet: p.wallet, amount: p.payout }))
            );

            // Update payout records with signature
            for (const payout of batch) {
              await supabase
                .from("holder_reward_payouts")
                .update({ status: "sent", signature })
                .eq("snapshot_id", snapshot.id)
                .eq("wallet_address", payout.wallet);
            }

            distributedInThisPool += batch.reduce((sum, p) => sum + p.payout, 0);
            console.log(`[fun-holder-distribute] ✅ Batch sent: ${signature.slice(0, 16)}...`);
          } catch (txError) {
            console.error(`[fun-holder-distribute] ❌ Batch failed:`, txError);
            
            // Mark batch payouts as failed
            for (const payout of batch) {
              await supabase
                .from("holder_reward_payouts")
                .update({ 
                  status: "failed", 
                  error_message: txError instanceof Error ? txError.message : "Unknown error" 
                })
                .eq("snapshot_id", snapshot.id)
                .eq("wallet_address", payout.wallet);
            }
          }
        }

        // STEP 4.8: Update pool and snapshot
        const newAccumulated = skippedAmount; // Keep skipped amount for next cycle

        await supabase
          .from("holder_reward_pool")
          .update({
            accumulated_sol: newAccumulated,
            last_distribution_at: new Date().toISOString(),
            total_distributed_sol: (pool.total_distributed_sol || 0) + distributedInThisPool,
            distribution_count: (pool.distribution_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pool.id);

        await supabase
          .from("holder_reward_snapshots")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", snapshot.id);

        totalDistributed += distributedInThisPool;
        successCount++;

        results.push({
          token: token.ticker,
          status: "success",
          holdersFound: holders.length,
          qualifiedHolders: validPayouts.length,
          poolSol,
          distributed: distributedInThisPool,
          skippedAmount,
        });

      } catch (error) {
        console.error(`[fun-holder-distribute] ❌ Error processing ${token.ticker}:`, error);
        
        await supabase
          .from("holder_reward_snapshots")
          .update({ 
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString()
          })
          .eq("id", snapshot.id);

        failureCount++;
        results.push({
          token: token.ticker,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // ===== STEP 5: Release lock =====
    await supabase
      .from("cron_locks")
      .delete()
      .eq("lock_name", LOCK_NAME);

    const duration = Date.now() - startTime;
    console.log(`[fun-holder-distribute] ✅ Complete: ${successCount} success, ${failureCount} failed, ${totalDistributed.toFixed(4)} SOL in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: eligiblePools.length,
        successful: successCount,
        failed: failureCount,
        totalDistributedSol: totalDistributed,
        durationMs: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-holder-distribute] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Chunk array into batches
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper: Fetch top token holders via Helius
async function fetchTopHolders(
  rpcUrl: string,
  mintAddress: string,
  limit: number
): Promise<Array<{ address: string; balance: number }>> {
  try {
    // Use getTokenLargestAccounts RPC method
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [mintAddress],
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("[fun-holder-distribute] RPC error:", data.error);
      return [];
    }

    const accounts = data.result?.value || [];
    
    // Map to owner addresses (need to resolve token accounts to owners)
    const holders: Array<{ address: string; balance: number }> = [];
    
    for (const account of accounts.slice(0, limit)) {
      try {
        // Get account info to find owner
        const accountInfoResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [
              account.address,
              { encoding: "jsonParsed" },
            ],
          }),
        });

        const accountInfoData = await accountInfoResponse.json();
        const owner = accountInfoData.result?.value?.data?.parsed?.info?.owner;
        
        if (owner) {
          // Balance is in token amount (need to handle decimals - assume 9 decimals)
          const balance = Number(account.uiAmount || 0);
          holders.push({ address: owner, balance });
        }
      } catch (e) {
        console.warn("[fun-holder-distribute] Failed to resolve holder:", e);
      }
    }

    return holders;
  } catch (error) {
    console.error("[fun-holder-distribute] Failed to fetch holders:", error);
    return [];
  }
}

// Helper: Send batched SOL transfers
async function sendBatchTransfer(
  connection: Connection,
  fromKeypair: Keypair,
  transfers: Array<{ wallet: string; amount: number }>
): Promise<string> {
  const transaction = new Transaction();

  for (const transfer of transfers) {
    try {
      const recipientPubkey = new PublicKey(transfer.wallet);
      const lamports = Math.floor(transfer.amount * 1e9);

      if (lamports <= 0) continue;

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );
    } catch (e) {
      console.warn(`[fun-holder-distribute] Invalid wallet ${transfer.wallet}:`, e);
    }
  }

  if (transaction.instructions.length === 0) {
    throw new Error("No valid transfers in batch");
  }

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKeypair.publicKey;

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair], {
    commitment: "confirmed",
    maxRetries: 3,
  });

  return signature;
}
