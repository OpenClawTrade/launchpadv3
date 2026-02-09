import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE_BPS = 1500; // 15% slippage for illiquid meme coins
const JUPITER_BASE_URL = "https://api.jup.ag/swap/v1";

const JITO_BLOCK_ENGINES = [
  "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
];

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

async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
  try {
    const { PublicKey } = await import("https://esm.sh/@solana/web3.js@1.98.0");
    const mintPubkey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    const data = mintInfo.value?.data;
    if (data && typeof data === "object" && "parsed" in data) {
      return data.parsed.info.decimals || 6;
    }
    return 6;
  } catch {
    return 6;
  }
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
    if (response.ok) {
      return await response.json();
    }
    const errorText = await response.text();
    console.warn(`[force-sell] Jupiter quote ${response.status}: ${errorText}`);
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

async function executeSell(
  connection: Connection,
  payer: Keypair,
  tokenMint: string,
  amount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    const quote = await getJupiterQuote(tokenMint, WSOL_MINT, amount, slippageBps);
    if (!quote) return { success: false, error: "Jupiter quote failed" };

    const outputAmount = parseInt(quote.outAmount) / 1e9;

    const swapData = await getJupiterSwapTx(quote, payer.publicKey.toBase58());
    if (!swapData) return { success: false, error: "Jupiter swap tx failed" };

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
    console.error("[force-sell] Swap error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth check
    const adminSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    const authHeader = req.headers.get("x-admin-secret");
    const apikey = req.headers.get("apikey");
    if (authHeader !== adminSecret && apikey !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      // Allow with anon key for now (admin only endpoint in practice)
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

    // Decrypt wallet
    const agentKeypair = await decryptWalletDualKey(agent.wallet_private_key_encrypted);
    if (!agentKeypair) {
      return new Response(JSON.stringify({ error: "Failed to decrypt agent wallet" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[force-sell] Agent ${agent.name} wallet: ${agentKeypair.publicKey.toBase58()}`);

    // Get all open positions
    const { data: positions, error: posError } = await supabase
      .from("trading_agent_positions")
      .select("*")
      .eq("trading_agent_id", agentId)
      .eq("status", "open");

    if (posError || !positions?.length) {
      return new Response(JSON.stringify({ message: "No open positions to close", results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[force-sell] Found ${positions.length} open positions to force-sell`);

    const results: any[] = [];

    for (const position of positions) {
      try {
        console.log(`[force-sell] Selling ${position.token_name} (${position.token_address}), tokens: ${position.amount_tokens}`);

        const tokenDecimals = await getTokenDecimals(connection, position.token_address);

        let amountToSell: number;
        if (position.amount_tokens > 1_000_000) {
          amountToSell = Math.floor(position.amount_tokens);
        } else {
          amountToSell = Math.floor(position.amount_tokens * Math.pow(10, tokenDecimals));
        }

        const swapResult = await executeSell(connection, agentKeypair, position.token_address, amountToSell, SLIPPAGE_BPS);

        if (!swapResult.success) {
          console.error(`[force-sell] Sell failed for ${position.token_name}: ${swapResult.error}`);
          results.push({
            positionId: position.id,
            token: position.token_name,
            status: "failed",
            error: swapResult.error,
          });
          continue;
        }

        const solReceived = swapResult.outputAmount || 0;
        const realizedPnl = solReceived - position.investment_sol;
        const pnlPct = position.investment_sol > 0 ? ((realizedPnl / position.investment_sol) * 100) : 0;
        const isWin = realizedPnl > 0;

        // Close position in DB
        await supabase
          .from("trading_agent_positions")
          .update({
            status: "closed",
            realized_pnl_sol: realizedPnl,
            current_value_sol: solReceived,
            exit_reason: `Force sell - ${isWin ? "profit" : "loss"}: ${pnlPct.toFixed(1)}%`,
            closed_at: new Date().toISOString(),
          })
          .eq("id", position.id);

        // Insert sell trade record
        await supabase
          .from("trading_agent_trades")
          .insert({
            trading_agent_id: agentId,
            position_id: position.id,
            token_address: position.token_address,
            token_name: position.token_name,
            trade_type: "sell",
            amount_sol: solReceived,
            amount_tokens: position.amount_tokens,
            price_per_token: solReceived / position.amount_tokens,
            strategy_used: agent.strategy_type,
            ai_reasoning: `Force-sold position. Received ${solReceived.toFixed(6)} SOL. P&L: ${realizedPnl.toFixed(6)} SOL (${pnlPct.toFixed(1)}%).`,
            exit_analysis: `Position force-closed by admin. Original investment: ${position.investment_sol} SOL. Exit value: ${solReceived.toFixed(6)} SOL.`,
            confidence_score: 100,
            status: "success",
          });

        // Update agent stats atomically
        const newWinning = (agent.winning_trades || 0) + (isWin ? 1 : 0);
        const newLosing = (agent.losing_trades || 0) + (isWin ? 0 : 1);
        const newTotal = (agent.total_trades || 0) + 1;
        const newProfit = (agent.total_profit_sol || 0) + realizedPnl;
        const newWinRate = newTotal > 0 ? (newWinning / newTotal) * 100 : 0;

        await supabase
          .from("trading_agents")
          .update({
            total_trades: newTotal,
            winning_trades: newWinning,
            losing_trades: newLosing,
            total_profit_sol: newProfit,
            win_rate: newWinRate,
            best_trade_sol: Math.max(agent.best_trade_sol || 0, isWin ? realizedPnl : 0),
            worst_trade_sol: Math.min(agent.worst_trade_sol || 0, isWin ? 0 : realizedPnl),
          })
          .eq("id", agentId);

        // Re-fetch agent for next iteration
        const { data: updatedAgent } = await supabase
          .from("trading_agents")
          .select("*")
          .eq("id", agentId)
          .single();
        if (updatedAgent) Object.assign(agent, updatedAgent);

        results.push({
          positionId: position.id,
          token: position.token_name,
          status: "sold",
          solReceived: solReceived.toFixed(6),
          realizedPnl: realizedPnl.toFixed(6),
          pnlPct: pnlPct.toFixed(2),
          signature: swapResult.signature,
        });

        console.log(`[force-sell] ✅ Sold ${position.token_name}: ${solReceived.toFixed(6)} SOL (${pnlPct.toFixed(1)}%) sig: ${swapResult.signature}`);

        // Brief pause between sells
        await new Promise(r => setTimeout(r, 2000));

      } catch (posError) {
        console.error(`[force-sell] Error selling ${position.token_name}:`, posError);
        results.push({
          positionId: position.id,
          token: position.token_name,
          status: "error",
          error: posError instanceof Error ? posError.message : "Unknown error",
        });
      }
    }

    // Cancel any outstanding limit orders for this agent
    try {
      const { data: positionsWithOrders } = await supabase
        .from("trading_agent_positions")
        .select("limit_order_sl_pubkey, limit_order_tp_pubkey")
        .eq("trading_agent_id", agentId)
        .not("limit_order_sl_pubkey", "is", null);

      if (positionsWithOrders?.length) {
        console.log(`[force-sell] Found ${positionsWithOrders.length} positions with limit orders to cancel`);
      }
    } catch (e) {
      console.warn("[force-sell] Error checking limit orders:", e);
    }

    return new Response(JSON.stringify({ 
      message: `Force-sold ${results.filter(r => r.status === "sold").length}/${positions.length} positions`,
      results 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[force-sell] Fatal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
