import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, VersionedTransaction, PublicKey, Transaction, SystemProgram } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_BASE_URL = "https://api.jup.ag/swap/v1";
const JUPITER_TRIGGER_URL = "https://api.jup.ag/trigger/v1";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const JITO_BLOCK_ENGINES = [
  "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
];

const SKIP_MINTS = new Set([
  WSOL_MINT,
  "11111111111111111111111111111111",
]);

// Escalating slippage levels for retries
const SLIPPAGE_LEVELS = [1500, 2500, 5000]; // 15%, 25%, 50%

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw new Error("All fetch retries exhausted");
}

async function decryptWallet(encryptedKey: string, encryptionKey: string): Promise<Keypair | null> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionKey);
    const keyHash = await crypto.subtle.digest("SHA-256", keyData);
    const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["decrypt"]);
    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const privateKeyBase58 = new TextDecoder().decode(decrypted);
    const secretKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error("[force-sell] Wallet decryption failed:", error);
    return null;
  }
}

async function decryptWalletDualKey(encryptedKey: string): Promise<Keypair | null> {
  const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
  const WALLET_ENCRYPTION_KEY = Deno.env.get("WALLET_ENCRYPTION_KEY");
  if (API_ENCRYPTION_KEY) {
    const result = await decryptWallet(encryptedKey, API_ENCRYPTION_KEY);
    if (result) return result;
  }
  if (WALLET_ENCRYPTION_KEY) {
    const result = await decryptWallet(encryptedKey, WALLET_ENCRYPTION_KEY);
    if (result) return result;
  }
  return null;
}

async function getJupiterQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number) {
  const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
  if (!jupiterApiKey) {
    console.error("[force-sell] JUPITER_API_KEY not configured");
    return null;
  }
  try {
    const quoteUrl = `${JUPITER_BASE_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const response = await fetchWithRetry(quoteUrl, { headers: { "x-api-key": jupiterApiKey } });
    if (response.ok) return await response.json();
    console.warn(`[force-sell] Jupiter quote ${response.status}: ${await response.text()}`);
    return null;
  } catch (e) {
    console.error("[force-sell] Jupiter quote failed:", e);
    return null;
  }
}

async function getJupiterSwapTx(quote: any, userPublicKey: string) {
  const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
  if (!jupiterApiKey) return null;
  try {
    const response = await fetchWithRetry(`${JUPITER_BASE_URL}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": jupiterApiKey },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    if (response.ok) return await response.json();
    console.warn(`[force-sell] Jupiter swap ${response.status}: ${await response.text()}`);
    return null;
  } catch (e) {
    console.error("[force-sell] Jupiter swap failed:", e);
    return null;
  }
}

async function executeSellOnce(
  connection: Connection,
  payer: Keypair,
  tokenMint: string,
  amount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    const quote = await getJupiterQuote(tokenMint, WSOL_MINT, amount, slippageBps);
    if (!quote) return { success: false, error: `No quote at ${slippageBps}bps` };

    const outputAmount = parseInt(quote.outAmount) / 1e9;
    const swapData = await getJupiterSwapTx(quote, payer.publicKey.toBase58());
    if (!swapData) return { success: false, error: "Swap tx build failed" };

    const swapTransactionBuf = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.message.recentBlockhash = blockhash;
    transaction.sign([payer]);

    // Try Jito first
    const blockEngine = JITO_BLOCK_ENGINES[Math.floor(Math.random() * JITO_BLOCK_ENGINES.length)];
    const serializedTx = bs58.encode(transaction.serialize());

    try {
      const jitoResponse = await fetch(blockEngine, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendBundle", params: [[serializedTx]] }),
      });
      const jitoResult = await jitoResponse.json();
      if (!jitoResult.error && jitoResult.result) {
        const signature = bs58.encode(transaction.signatures[0]);
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
            return { success: true, signature, outputAmount };
          }
          if (status.value?.err) break;
        }
      }
    } catch (jitoError) {
      console.warn("[force-sell] Jito failed, falling back:", jitoError);
    }

    // Fallback to standard send
    const signature = await connection.sendTransaction(transaction, { skipPreflight: true, maxRetries: 5 });
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
        return { success: true, signature, outputAmount };
      }
      if (status.value?.err) {
        return { success: false, error: `Tx error: ${JSON.stringify(status.value.err)}` };
      }
    }
    return { success: false, error: "Transaction confirmation timeout" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Retry with escalating slippage
async function executeSellWithRetry(
  connection: Connection,
  payer: Keypair,
  tokenMint: string,
  amount: number,
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string; slippageUsed?: number }> {
  for (const slippage of SLIPPAGE_LEVELS) {
    console.log(`[force-sell] Trying sell at ${slippage}bps slippage...`);
    const result = await executeSellOnce(connection, payer, tokenMint, amount, slippage);
    if (result.success) {
      return { ...result, slippageUsed: slippage };
    }
    console.warn(`[force-sell] Failed at ${slippage}bps: ${result.error}`);
    // Don't retry if it's a fundamental issue (no quote means token is truly illiquid)
    if (result.error?.includes("No quote")) continue;
    // Brief pause before retry
    await new Promise(r => setTimeout(r, 1000));
  }
  return { success: false, error: `Failed at all slippage levels (${SLIPPAGE_LEVELS.join(', ')}bps)` };
}

// Cancel all outstanding Jupiter limit orders for this wallet
async function cancelAllLimitOrders(connection: Connection, payer: Keypair): Promise<number> {
  const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
  if (!jupiterApiKey) return 0;
  
  let cancelled = 0;
  try {
    const walletAddress = payer.publicKey.toBase58();
    const response = await fetchWithRetry(
      `${JUPITER_TRIGGER_URL}/getTriggerOrders?user=${walletAddress}&orderStatus=active`,
      { headers: { "x-api-key": jupiterApiKey } }
    );
    
    if (!response.ok) {
      console.warn(`[force-sell] getTriggerOrders failed: ${response.status}`);
      return 0;
    }
    
    const data = await response.json();
    const orders = data.orders || data;
    if (!Array.isArray(orders) || orders.length === 0) {
      console.log("[force-sell] No active limit orders to cancel");
      return 0;
    }

    console.log(`[force-sell] Found ${orders.length} active limit orders to cancel`);
    
    const orderKeys = orders.map((o: any) => o.publicKey || o.orderKey || o.account).filter(Boolean);
    if (orderKeys.length === 0) return 0;

    // Use /cancelOrders (plural) for batch cancellation
    const cancelResponse = await fetchWithRetry(`${JUPITER_TRIGGER_URL}/cancelOrders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": jupiterApiKey },
      body: JSON.stringify({ maker: walletAddress, computeUnitPrice: "auto" }),
    });

    if (cancelResponse.ok) {
      const cancelData = await cancelResponse.json();
      // cancelOrders returns an array of transactions (batched in groups of 5)
      const transactions = cancelData.transactions || (cancelData.transaction ? [cancelData.transaction] : []);
      for (const txBase64 of transactions) {
        const txBuf = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
        const transaction = VersionedTransaction.deserialize(txBuf);
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        transaction.message.recentBlockhash = blockhash;
        transaction.sign([payer]);
        
        const sig = await connection.sendTransaction(transaction, { skipPreflight: true, maxRetries: 3 });
        console.log(`[force-sell] ✅ Cancelled orders batch, sig: ${sig}`);
      }
      cancelled = orderKeys.length;
    }
  } catch (e) {
    console.warn("[force-sell] Error cancelling limit orders:", e);
  }
  return cancelled;
}

// Close empty token accounts to reclaim rent
async function closeEmptyTokenAccounts(connection: Connection, payer: Keypair): Promise<number> {
  let closed = 0;
  try {
    // We use a manual approach with createCloseAccountInstruction equivalent
    // For simplicity, we just scan and close via raw instruction
    const [splAccounts, t22Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(payer.publicKey, { programId: TOKEN_PROGRAM }),
      connection.getParsedTokenAccountsByOwner(payer.publicKey, { programId: TOKEN_2022_PROGRAM }),
    ]);

    const emptyAccounts = [...splAccounts.value, ...t22Accounts.value].filter(a => {
      const amount = a.account.data.parsed?.info?.tokenAmount?.amount;
      return amount === "0";
    });

    if (emptyAccounts.length === 0) return 0;
    console.log(`[force-sell] Found ${emptyAccounts.length} empty token accounts to close`);

    // Close in batches of 10
    const CLOSE_BATCH = 10;
    for (let i = 0; i < Math.min(emptyAccounts.length, 30); i += CLOSE_BATCH) {
      const batch = emptyAccounts.slice(i, i + CLOSE_BATCH);
      try {
        // Build close instructions using raw transaction
        // CloseAccount instruction = [9] for SPL Token
        const tx = new Transaction();
        for (const acc of batch) {
          const tokenAccountPubkey = acc.pubkey;
          const programId = acc.account.owner;
          // CloseAccount instruction index = 9
          const data = Buffer.alloc(1);
          data.writeUInt8(9, 0);
          tx.add({
            keys: [
              { pubkey: tokenAccountPubkey, isSigner: false, isWritable: true },
              { pubkey: payer.publicKey, isSigner: false, isWritable: true },
              { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            ],
            programId: new PublicKey(programId),
            data,
          });
        }
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = payer.publicKey;
        tx.sign(payer);
        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
        console.log(`[force-sell] Closed ${batch.length} empty accounts, sig: ${sig}`);
        closed += batch.length;
      } catch (e) {
        console.warn("[force-sell] Error closing empty accounts batch:", e);
      }
    }
  } catch (e) {
    console.warn("[force-sell] Error scanning empty accounts:", e);
  }
  return closed;
}

// Update agent stats after a successful sell
async function updateAgentStats(
  supabase: any,
  agentId: string,
  tokenAddress: string,
  sellAmountSol: number,
  sellTime: Date
) {
  try {
    // Find the matching buy trade
    const { data: buyTrade } = await supabase
      .from("trading_agent_trades")
      .select("amount_sol, created_at")
      .eq("trading_agent_id", agentId)
      .eq("token_address", tokenAddress)
      .eq("trade_type", "buy")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!buyTrade) {
      console.warn(`[force-sell] No buy trade found for ${tokenAddress}, skipping stats update`);
      return;
    }

    const pnl = sellAmountSol - buyTrade.amount_sol;
    const isWin = pnl >= 0;
    const holdTimeMs = sellTime.getTime() - new Date(buyTrade.created_at).getTime();
    const holdTimeMinutes = Math.max(1, Math.round(holdTimeMs / 60000));

    // Get current agent stats
    const { data: currentAgent } = await supabase
      .from("trading_agents")
      .select("total_profit_sol, winning_trades, losing_trades, total_trades, avg_hold_time_minutes, best_trade_sol, worst_trade_sol")
      .eq("id", agentId)
      .single();

    if (!currentAgent) return;

    const newTotalTrades = (currentAgent.total_trades || 0) + 1;
    const newWinning = (currentAgent.winning_trades || 0) + (isWin ? 1 : 0);
    const newLosing = (currentAgent.losing_trades || 0) + (isWin ? 0 : 1);
    const newWinRate = newTotalTrades > 0 ? (newWinning / newTotalTrades) * 100 : 0;
    const newTotalProfit = (currentAgent.total_profit_sol || 0) + pnl;
    const oldAvg = currentAgent.avg_hold_time_minutes || 0;
    const oldCount = currentAgent.total_trades || 0;
    const newAvgHold = oldCount > 0
      ? (oldAvg * oldCount + holdTimeMinutes) / newTotalTrades
      : holdTimeMinutes;
    const newBest = Math.max(currentAgent.best_trade_sol || -Infinity, pnl);
    const newWorst = Math.min(currentAgent.worst_trade_sol || Infinity, pnl);

    await supabase.from("trading_agents").update({
      total_profit_sol: newTotalProfit,
      winning_trades: newWinning,
      losing_trades: newLosing,
      total_trades: newTotalTrades,
      win_rate: newWinRate,
      avg_hold_time_minutes: Math.round(newAvgHold),
      best_trade_sol: newBest === -Infinity ? null : newBest,
      worst_trade_sol: newWorst === Infinity ? null : newWorst,
    }).eq("id", agentId);

    console.log(`[force-sell] 📊 Stats updated: PnL=${pnl.toFixed(6)}, W/L=${newWinning}/${newLosing}, WR=${newWinRate.toFixed(1)}%, AvgHold=${Math.round(newAvgHold)}min`);
  } catch (err) {
    console.error("[force-sell] Error updating agent stats:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, sellAll, adminSecret } = await req.json();
    
    // Require admin secret for security
    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // Get agent with encrypted wallet
    const { data: agent, error: agentError } = await supabase
      .from("trading_agents")
      .select("*, wallet_private_key_encrypted")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const agentKeypair = await decryptWalletDualKey(agent.wallet_private_key_encrypted);
    if (!agentKeypair) {
      return new Response(JSON.stringify({ error: "Failed to decrypt agent wallet" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const walletAddress = agentKeypair.publicKey.toBase58();
    console.log(`[force-sell] Agent ${agent.name} wallet: ${walletAddress}, sellAll=${!!sellAll}`);

    // Cancel all outstanding limit orders first
    const cancelledOrders = await cancelAllLimitOrders(connection, agentKeypair);
    console.log(`[force-sell] Cancelled ${cancelledOrders} limit orders`);

    const results: any[] = [];

    if (sellAll) {
      // === SELL ALL MODE: Scan wallet for ALL token accounts (SPL + Token-2022) ===
      console.log(`[force-sell] sellAll mode: scanning wallet for all token holdings...`);
      
      const [splAccounts, t22Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(agentKeypair.publicKey, { programId: TOKEN_PROGRAM }),
        connection.getParsedTokenAccountsByOwner(agentKeypair.publicKey, { programId: TOKEN_2022_PROGRAM }),
      ]);

      const allTokenAccounts = [...splAccounts.value, ...t22Accounts.value];
      console.log(`[force-sell] Found ${allTokenAccounts.length} token accounts (SPL: ${splAccounts.value.length}, T22: ${t22Accounts.value.length})`);

      // Get all DB positions for cross-reference
      const { data: dbPositions } = await supabase
        .from("trading_agent_positions")
        .select("*")
        .eq("trading_agent_id", agentId)
        .eq("status", "open");

      const dbPositionMap = new Map((dbPositions || []).map(p => [p.token_address, p]));

      for (const account of allTokenAccounts) {
        const parsed = account.account.data.parsed?.info;
        if (!parsed) continue;

        const mint = parsed.mint;
        const tokenAmount = parsed.tokenAmount;
        const rawAmount = parseInt(tokenAmount?.amount || "0");

        if (rawAmount === 0 || SKIP_MINTS.has(mint)) continue;

        const dbPosition = dbPositionMap.get(mint);
        const tokenName = dbPosition?.token_name || mint.slice(0, 8) + "...";

        console.log(`[force-sell] Selling ${tokenName} (${mint}), raw: ${rawAmount}`);

        try {
          const swapResult = await executeSellWithRetry(connection, agentKeypair, mint, rawAmount);

          if (!swapResult.success) {
            console.error(`[force-sell] ❌ Sell failed for ${tokenName}: ${swapResult.error}`);
            results.push({ token: tokenName, mint, status: "failed", error: swapResult.error });
            continue;
          }

          const solReceived = swapResult.outputAmount || 0;

          if (dbPosition) {
            const realizedPnl = solReceived - dbPosition.investment_sol;
            const pnlPct = dbPosition.investment_sol > 0 ? ((realizedPnl / dbPosition.investment_sol) * 100) : 0;

            await supabase.from("trading_agent_positions").update({
              status: "closed",
              realized_pnl_sol: realizedPnl,
              current_value_sol: solReceived,
              exit_reason: `Force sell (sellAll) - ${realizedPnl > 0 ? "profit" : "loss"}: ${pnlPct.toFixed(1)}%`,
              closed_at: new Date().toISOString(),
            }).eq("id", dbPosition.id);

            // Update agent performance stats
            await updateAgentStats(supabase, agentId, mint, solReceived, new Date());

            await supabase.from("trading_agent_trades").insert({
              trading_agent_id: agentId,
              position_id: dbPosition.id,
              token_address: mint,
              token_name: dbPosition.token_name,
              trade_type: "sell",
              amount_sol: solReceived,
              amount_tokens: dbPosition.amount_tokens,
              price_per_token: solReceived / dbPosition.amount_tokens,
              strategy_used: agent.strategy_type,
              ai_reasoning: `Force-sold (sellAll) at ${swapResult.slippageUsed}bps slippage. Received ${solReceived.toFixed(6)} SOL. P&L: ${realizedPnl.toFixed(6)} SOL (${pnlPct.toFixed(1)}%).`,
              confidence_score: 100,
              status: "success",
              signature: swapResult.signature,
            });
          }

          results.push({
            token: tokenName, mint, status: "sold",
            solReceived: solReceived.toFixed(6),
            signature: swapResult.signature,
            slippageUsed: swapResult.slippageUsed,
            hadDbPosition: !!dbPosition,
          });

          console.log(`[force-sell] ✅ Sold ${tokenName}: ${solReceived.toFixed(6)} SOL, sig: ${swapResult.signature}`);
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          console.error(`[force-sell] Error selling ${tokenName}:`, err);
          results.push({ token: tokenName, mint, status: "error", error: err instanceof Error ? err.message : "Unknown" });
        }
      }

      // Close remaining DB positions not found on-chain
      if (dbPositions?.length) {
        for (const pos of dbPositions) {
          if (!results.some(r => r.mint === pos.token_address && r.status === "sold")) {
            await supabase.from("trading_agent_positions").update({
              status: "closed",
              realized_pnl_sol: -pos.investment_sol,
              current_value_sol: 0,
              exit_reason: "Force closed (sellAll) - token not found in wallet",
              closed_at: new Date().toISOString(),
            }).eq("id", pos.id);
            results.push({ token: pos.token_name, mint: pos.token_address, status: "closed_no_balance" });
          }
        }
      }
    } else {
      // === ORIGINAL MODE: Only sell DB-tracked positions ===
      const { data: positions, error: posError } = await supabase
        .from("trading_agent_positions")
        .select("*")
        .eq("trading_agent_id", agentId)
        .eq("status", "open");

      if (posError || !positions?.length) {
        return new Response(JSON.stringify({ message: "No open positions to close", results: [], cancelledOrders }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[force-sell] Found ${positions.length} open positions to force-sell`);

      for (const position of positions) {
        try {
          // Get actual on-chain balance
          let amountToSell: number;
          try {
            const [splAccounts, t22Accounts] = await Promise.all([
              connection.getParsedTokenAccountsByOwner(agentKeypair.publicKey, { mint: new PublicKey(position.token_address) }),
              connection.getParsedTokenAccountsByOwner(agentKeypair.publicKey, { mint: new PublicKey(position.token_address) }).catch(() => ({ value: [] })),
            ]);
            const allAccounts = [...splAccounts.value, ...(t22Accounts as any).value];
            const onChainBalance = allAccounts[0]?.account?.data?.parsed?.info?.tokenAmount;
            if (onChainBalance && parseInt(onChainBalance.amount) > 0) {
              amountToSell = parseInt(onChainBalance.amount);
            } else {
              await supabase.from("trading_agent_positions").update({
                status: "closed",
                realized_pnl_sol: -position.investment_sol,
                exit_reason: "Force closed - no on-chain balance",
                closed_at: new Date().toISOString(),
              }).eq("id", position.id);
              results.push({ positionId: position.id, token: position.token_name, status: "no_balance" });
              continue;
            }
          } catch {
            const tokenDecimals = 6;
            amountToSell = position.amount_tokens > 1_000_000
              ? Math.floor(position.amount_tokens)
              : Math.floor(position.amount_tokens * Math.pow(10, tokenDecimals));
          }

          const swapResult = await executeSellWithRetry(connection, agentKeypair, position.token_address, amountToSell);

          if (!swapResult.success) {
            results.push({ positionId: position.id, token: position.token_name, status: "failed", error: swapResult.error });
            continue;
          }

          const solReceived = swapResult.outputAmount || 0;
          const realizedPnl = solReceived - position.investment_sol;
          const pnlPct = position.investment_sol > 0 ? ((realizedPnl / position.investment_sol) * 100) : 0;

          await supabase.from("trading_agent_positions").update({
            status: "closed",
            realized_pnl_sol: realizedPnl,
            current_value_sol: solReceived,
            exit_reason: `Force sell - ${realizedPnl > 0 ? "profit" : "loss"}: ${pnlPct.toFixed(1)}%`,
            closed_at: new Date().toISOString(),
          }).eq("id", position.id);

          await supabase.from("trading_agent_trades").insert({
            trading_agent_id: agentId,
            position_id: position.id,
            token_address: position.token_address,
            token_name: position.token_name,
            trade_type: "sell",
            amount_sol: solReceived,
            amount_tokens: position.amount_tokens,
            price_per_token: solReceived / position.amount_tokens,
            strategy_used: agent.strategy_type,
            ai_reasoning: `Force-sold at ${swapResult.slippageUsed}bps. Received ${solReceived.toFixed(6)} SOL. P&L: ${realizedPnl.toFixed(6)} SOL (${pnlPct.toFixed(1)}%).`,
            confidence_score: 100,
            status: "success",
            signature: swapResult.signature,
          });

          // Update agent performance stats
          await updateAgentStats(supabase, agentId, position.token_address, solReceived, new Date());

          results.push({
            positionId: position.id,
            token: position.token_name,
            status: "sold",
            solReceived: solReceived.toFixed(6),
            realizedPnl: realizedPnl.toFixed(6),
            pnlPct: pnlPct.toFixed(2),
            signature: swapResult.signature,
            slippageUsed: swapResult.slippageUsed,
          });

          console.log(`[force-sell] ✅ Sold ${position.token_name}: ${solReceived.toFixed(6)} SOL sig: ${swapResult.signature}`);
          await new Promise(r => setTimeout(r, 2000));
        } catch (posError) {
          results.push({ positionId: position.id, token: position.token_name, status: "error", error: posError instanceof Error ? posError.message : "Unknown" });
        }
      }
    }

    // Close empty token accounts to reclaim rent SOL
    const closedAccounts = await closeEmptyTokenAccounts(connection, agentKeypair);
    console.log(`[force-sell] Closed ${closedAccounts} empty token accounts`);

    const soldCount = results.filter(r => r.status === "sold").length;
    return new Response(JSON.stringify({ 
      message: `Force-sold ${soldCount}/${results.length} tokens. Cancelled ${cancelledOrders} limit orders. Closed ${closedAccounts} empty accounts.`,
      results,
      cancelledOrders,
      closedAccounts,
      sellAll: !!sellAll,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[force-sell] Fatal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
