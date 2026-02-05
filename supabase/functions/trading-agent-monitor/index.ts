import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strategy configurations
const STRATEGIES = {
  conservative: { stopLoss: 10, takeProfit: 25 },
  balanced: { stopLoss: 20, takeProfit: 50 },
  aggressive: { stopLoss: 30, takeProfit: 100 },
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const SLIPPAGE_BPS = 500; // 5%

// High-frequency polling configuration
const MAX_RUNTIME_MS = 50000; // 50 seconds (leave 10s buffer for Edge Function timeout)
const POLL_INTERVAL_MS = 15000; // 15 seconds between checks

// Jito Block Engines for MEV-protected execution
const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[trading-agent-monitor] Starting position monitoring cycle...");
  const startTime = Date.now();
  let totalChecks = 0;
  let totalTrades = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) {
      throw new Error("API_ENCRYPTION_KEY not configured");
    }

    const HELIUS_RPC_URL = Deno.env.get("HELIUS_RPC_URL");
    if (!HELIUS_RPC_URL) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    const connection = new Connection(HELIUS_RPC_URL, "confirmed");

    const results: any[] = [];
    let closedCount = 0;
    let stopLossCount = 0;
    let takeProfitCount = 0;

    // High-frequency polling loop - check positions every 15 seconds
    while (Date.now() - startTime < MAX_RUNTIME_MS) {
      totalChecks++;
      console.log(`[trading-agent-monitor] Check #${totalChecks} at ${Date.now() - startTime}ms...`);

      // Get all open positions with agent info
      const { data: positions, error: posError } = await supabase
        .from("trading_agent_positions")
        .select(`
          *,
          trading_agent:trading_agents(
            id, name, strategy_type, trading_capital_sol,
            total_trades, winning_trades, losing_trades, win_rate,
            consecutive_wins, consecutive_losses, best_trade_sol, worst_trade_sol,
            learned_patterns, avoided_patterns, preferred_narratives,
            wallet_private_key_encrypted,
            agent:agents(id, name, avatar_url)
          )
        `)
        .eq("status", "open");

      if (posError) throw posError;
      
      if (!positions || positions.length === 0) {
        console.log(`[trading-agent-monitor] No open positions, waiting...`);
        // Wait before next check
        if (Date.now() - startTime + POLL_INTERVAL_MS < MAX_RUNTIME_MS) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        } else {
          break;
        }
      }

      console.log(`[trading-agent-monitor] Monitoring ${positions.length} open positions`);

      // Fetch current prices for all tokens (batch by token)
      const tokenAddresses = [...new Set(positions.map(p => p.token_address))];
      const priceMap = await fetchTokenPrices(tokenAddresses);

      for (const position of positions) {
        try {
          const agent = position.trading_agent;
          if (!agent) continue;

          const strategy = STRATEGIES[agent.strategy_type as keyof typeof STRATEGIES] || STRATEGIES.balanced;
          const currentPrice = priceMap.get(position.token_address) || position.current_price_sol;
          const entryPrice = position.entry_price_sol || 0;

          if (!currentPrice || !entryPrice) continue;

        // Calculate P&L
        const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;
        const currentValue = position.amount_tokens * currentPrice;
        const unrealizedPnl = currentValue - position.investment_sol;

        // Update position with current price
        await supabase
          .from("trading_agent_positions")
          .update({
            current_price_sol: currentPrice,
            current_value_sol: currentValue,
            unrealized_pnl_sol: unrealizedPnl,
            unrealized_pnl_pct: pnlPct,
          })
          .eq("id", position.id);

        // Check stop loss
        const hitStopLoss = pnlPct <= -strategy.stopLoss;
        // Check take profit  
        const hitTakeProfit = pnlPct >= strategy.takeProfit;

        if (hitStopLoss || hitTakeProfit) {
          // Time to close position - execute real Jupiter swap
          const closeReason = hitStopLoss ? "stop_loss" : "take_profit";

          // Decrypt agent's wallet private key
          const agentKeypair = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
          if (!agentKeypair) {
            console.error(`[trading-agent-monitor] Failed to decrypt wallet for ${agent.name}`);
            continue;
          }

          // Execute Jupiter swap: Token -> SOL
          const tokenDecimals = await getTokenDecimals(connection, position.token_address);
          const amountToSell = Math.floor(position.amount_tokens * Math.pow(10, tokenDecimals));

          const swapResult = await executeJupiterSwapWithJito(
            connection,
            agentKeypair,
            position.token_address,
            WSOL_MINT,
            amountToSell,
            SLIPPAGE_BPS
          );

          if (!swapResult.success) {
            console.error(`[trading-agent-monitor] Sell swap failed for ${agent.name}:`, swapResult.error);
            continue;
          }

          const solReceived = (swapResult.outputAmount || currentValue);
          const realizedPnl = solReceived - position.investment_sol;

          // Get AI analysis for the exit
          const exitAnalysis = await generateExitAnalysis(
            LOVABLE_API_KEY,
            agent,
            position,
            currentPrice,
            pnlPct,
            closeReason
          );

          // Get past trades for learning
          const { data: pastTrades } = await supabase
            .from("trading_agent_trades")
            .select("*")
            .eq("trading_agent_id", agent.id)
            .order("created_at", { ascending: false })
            .limit(20);

          // Close position
          await supabase
            .from("trading_agent_positions")
            .update({
              status: closeReason === "stop_loss" ? "stopped_out" : "take_profit",
              realized_pnl_sol: realizedPnl,
              exit_reason: exitAnalysis.exitReason,
              closed_at: new Date().toISOString(),
            })
            .eq("id", position.id);

          // Create sell trade record
          const { data: trade } = await supabase
            .from("trading_agent_trades")
            .insert({
              trading_agent_id: agent.id,
              position_id: position.id,
              token_address: position.token_address,
              token_name: position.token_name,
              trade_type: "sell",
              amount_sol: solReceived,
              amount_tokens: position.amount_tokens,
              price_per_token: currentPrice,
              strategy_used: agent.strategy_type,
              exit_analysis: exitAnalysis.fullAnalysis,
              ai_reasoning: exitAnalysis.reasoning,
              lessons_learned: exitAnalysis.lessonsLearned,
              market_context: exitAnalysis.marketContext,
              status: "confirmed",
              signature: swapResult.signature,
            })
            .select()
            .single();

          // Update agent stats
          const isWin = realizedPnl > 0;
          const newWinningTrades = (agent.winning_trades || 0) + (isWin ? 1 : 0);
          const newLosingTrades = (agent.losing_trades || 0) + (isWin ? 0 : 1);
          const newTotalTrades = (agent.total_trades || 0) + 1;
          const newWinRate = newTotalTrades > 0 ? (newWinningTrades / newTotalTrades) * 100 : 0;

          const consecutiveWins = isWin ? (agent.consecutive_wins || 0) + 1 : 0;
          const consecutiveLosses = isWin ? 0 : (agent.consecutive_losses || 0) + 1;

          const bestTrade = Math.max(agent.best_trade_sol || 0, isWin ? realizedPnl : 0);
          const worstTrade = Math.min(agent.worst_trade_sol || 0, isWin ? 0 : realizedPnl);

          // Calculate hold time
          const holdTimeMs = new Date().getTime() - new Date(position.opened_at).getTime();
          const holdTimeMinutes = Math.floor(holdTimeMs / 60000);
          const avgHoldTime = agent.avg_hold_time_minutes 
            ? Math.floor((agent.avg_hold_time_minutes + holdTimeMinutes) / 2)
            : holdTimeMinutes;

          // Update learned patterns if significant loss
          let avoidedPatterns = agent.avoided_patterns || [];
          let learnedPatterns = agent.learned_patterns || [];

          if (consecutiveLosses >= 3 && exitAnalysis.patternToAvoid) {
            avoidedPatterns = [...new Set([...avoidedPatterns, exitAnalysis.patternToAvoid])];
          }

          if (consecutiveWins >= 3 && exitAnalysis.successPattern) {
            learnedPatterns = [...learnedPatterns, {
              pattern: exitAnalysis.successPattern,
              winRate: newWinRate,
              learnedAt: new Date().toISOString(),
            }];
          }

          await supabase
            .from("trading_agents")
            .update({
              trading_capital_sol: (agent.trading_capital_sol || 0) + solReceived,
              total_profit_sol: (agent.total_profit_sol || 0) + realizedPnl,
              total_trades: newTotalTrades,
              winning_trades: newWinningTrades,
              losing_trades: newLosingTrades,
              win_rate: newWinRate,
              consecutive_wins: consecutiveWins,
              consecutive_losses: consecutiveLosses,
              best_trade_sol: bestTrade,
              worst_trade_sol: worstTrade,
              avg_hold_time_minutes: avgHoldTime,
              avoided_patterns: avoidedPatterns,
              learned_patterns: learnedPatterns,
              last_trade_at: new Date().toISOString(),
            })
            .eq("id", agent.id);

          // Post exit analysis to SubTuna
          if (trade) {
            await postExitToSubTuna(
              supabase,
              agent,
              trade,
              position,
              exitAnalysis,
              realizedPnl,
              pnlPct,
              closeReason,
              swapResult.signature
            );
          }

          // Check if strategy review needed (after 3+ consecutive losses or every 10 trades)
          if (consecutiveLosses >= 3 || newTotalTrades % 10 === 0) {
            await triggerStrategyReview(
              supabase,
              LOVABLE_API_KEY,
              agent,
              pastTrades || [],
              consecutiveLosses >= 3 ? "after_loss" : "periodic"
            );
          }

          results.push({
            positionId: position.id,
            agentName: agent.name,
            token: position.token_symbol,
            closeReason,
            pnlPct: pnlPct.toFixed(2),
            realizedPnl: realizedPnl.toFixed(6),
            signature: swapResult.signature,
          });

          closedCount++;
          if (hitStopLoss) stopLossCount++;
          if (hitTakeProfit) takeProfitCount++;

          console.log(`[trading-agent-monitor] ✅ ${agent.name} closed ${position.token_symbol}: ${closeReason} (${pnlPct.toFixed(2)}%) sig: ${swapResult.signature}`);
            totalTrades++;
        }

        } catch (positionError) {
          console.error(`[trading-agent-monitor] Error processing position ${position.id}:`, positionError);
        }
      }

      // Wait before next check (skip if near timeout)
      if (Date.now() - startTime + POLL_INTERVAL_MS < MAX_RUNTIME_MS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      } else {
        break;
      }
    }

    const totalRuntime = Date.now() - startTime;
    console.log(`[trading-agent-monitor] Completed ${totalChecks} checks, ${totalTrades} trades in ${totalRuntime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        totalChecks,
        closed: closedCount,
        stopLosses: stopLossCount,
        takeProfits: takeProfitCount,
        runtimeMs: totalRuntime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-monitor] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function decryptWallet(encryptedKey: string, encryptionKey: string): Promise<Keypair | null> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(encryptionKey);
    const keyHash = await crypto.subtle.digest("SHA-256", keyData);
    
    const key = await crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const privateKeyBase58 = new TextDecoder().decode(decrypted);
    const secretKey = bs58.decode(privateKeyBase58);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    console.error("[trading-agent-monitor] Wallet decryption failed:", error);
    return null;
  }
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
    return 6; // Default to 6 decimals
  } catch {
    return 6;
  }
}

async function executeJupiterSwap(
  connection: Connection,
  payer: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    // Get quote from Jupiter
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      return { success: false, error: `Quote failed: ${quoteResponse.status}` };
    }

    const quote = await quoteResponse.json();
    const outputAmount = parseInt(quote.outAmount) / 1e9; // SOL has 9 decimals

    // Get swap transaction
    const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: payer.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!swapResponse.ok) {
      return { success: false, error: `Swap request failed: ${swapResponse.status}` };
    }

    const swapData = await swapResponse.json();
    const swapTransactionBuf = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Sign and send transaction
    transaction.sign([payer]);
    
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      maxRetries: 3,
    });

    // Confirm transaction with retries
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
        confirmed = true;
        break;
      }
      if (status.value?.err) {
        return { success: false, error: `Transaction error: ${JSON.stringify(status.value.err)}` };
      }
    }

    if (!confirmed) {
      return { success: false, error: "Transaction confirmation timeout" };
    }

    return { success: true, signature, outputAmount };

  } catch (error) {
    console.error("[trading-agent-monitor] Jupiter swap error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown swap error" };
  }
}

async function fetchTokenPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  try {
    // Fetch real SOL price first
    const solPrice = await fetchSolPrice();
    console.log(`[trading-agent-monitor] Using SOL price: $${solPrice.toFixed(2)}`);

    // Try Jupiter price API first (more reliable)
    for (const address of tokenAddresses) {
      try {
        const response = await fetch(`https://price.jup.ag/v6/price?ids=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.[address]?.price) {
            // Jupiter returns USD price, convert to SOL
            priceMap.set(address, data.data[address].price / solPrice);
            continue;
          }
        }
      } catch {
        // Fall through to pump.fun API
      }

      // Fallback: pump.fun API
      try {
        const response = await fetch(`https://frontend-api.pump.fun/coins/${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.virtual_sol_reserves && data.virtual_token_reserves) {
            const priceSol = (data.virtual_sol_reserves / 1e9) / (data.virtual_token_reserves / 1e6);
            priceMap.set(address, priceSol);
          }
        }
      } catch (e) {
        console.warn(`[trading-agent-monitor] Failed to fetch price for ${address}`);
      }
    }
  } catch (error) {
    console.error("[trading-agent-monitor] Price fetch error:", error);
  }
  
  return priceMap;
}

// Fetch real SOL price from multiple sources
async function fetchSolPrice(): Promise<number> {
  // Try Jupiter first (most reliable for Solana ecosystem)
  try {
    const response = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112');
    if (response.ok) {
      const data = await response.json();
      const price = data.data?.['So11111111111111111111111111111111111111112']?.price;
      if (price && typeof price === 'number' && price > 0) {
        return price;
      }
    }
  } catch (e) {
    console.warn('[trading-agent-monitor] Jupiter SOL price fetch failed');
  }
  
  // Fallback: CoinGecko
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (response.ok) {
      const data = await response.json();
      if (data.solana?.usd) {
        return data.solana.usd;
      }
    }
  } catch (e) {
    console.warn('[trading-agent-monitor] CoinGecko SOL price fetch failed');
  }
  
  // Fallback: Binance
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
    if (response.ok) {
      const data = await response.json();
      const price = parseFloat(data.price);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  } catch (e) {
    console.warn('[trading-agent-monitor] Binance SOL price fetch failed');
  }
  
  // Final fallback: PyTH
  try {
    const response = await fetch('https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
    if (response.ok) {
      const data = await response.json();
      if (data[0]?.price?.price) {
        const price = parseFloat(data[0].price.price) * Math.pow(10, data[0].price.expo);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
  } catch (e) {
    console.warn('[trading-agent-monitor] Pyth SOL price fetch failed');
  }
  
  throw new Error('Unable to fetch SOL price from any source');
}

// MEV-protected swap via Jito bundles
async function executeJupiterSwapWithJito(
  connection: Connection,
  payer: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    // Get quote from Jupiter
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      return { success: false, error: `Quote failed: ${quoteResponse.status}` };
    }

    const quote = await quoteResponse.json();
    const outputAmount = parseInt(quote.outAmount) / 1e9; // SOL has 9 decimals

    // Get swap transaction with high priority fees
    const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: payer.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: { 
          priorityLevelWithMaxLamports: {
            maxLamports: 5_000_000, // 0.005 SOL max priority fee
            priorityLevel: "veryHigh"
          }
        },
      }),
    });

    if (!swapResponse.ok) {
      return { success: false, error: `Swap request failed: ${swapResponse.status}` };
    }

    const swapData = await swapResponse.json();
    const swapTransactionBuf = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.message.recentBlockhash = blockhash;

    // Sign transaction
    transaction.sign([payer]);

    // Try Jito bundle first for MEV protection
    const blockEngine = JITO_BLOCK_ENGINES[Math.floor(Math.random() * JITO_BLOCK_ENGINES.length)];
    const serializedTx = bs58.encode(transaction.serialize());

    console.log(`[trading-agent-monitor] Submitting to Jito: ${blockEngine}`);

    try {
      const jitoResponse = await fetch(blockEngine, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [[serializedTx]],
        }),
      });

      const jitoResult = await jitoResponse.json();

      if (!jitoResult.error && jitoResult.result) {
        console.log('[trading-agent-monitor] Jito bundle submitted:', jitoResult.result);
        
        // Wait for bundle confirmation
        const signature = bs58.encode(transaction.signatures[0]);
        let confirmed = false;
        
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
            confirmed = true;
            break;
          }
          if (status.value?.err) {
            break;
          }
        }

        if (confirmed) {
          console.log('[trading-agent-monitor] ✅ Jito bundle confirmed:', signature);
          return { success: true, signature, outputAmount };
        }
      }
      
      console.warn('[trading-agent-monitor] Jito bundle failed, falling back to standard send');
    } catch (jitoError) {
      console.warn('[trading-agent-monitor] Jito error, falling back:', jitoError);
    }

    // Fallback to standard send
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: true,
      maxRetries: 5,
    });

    // Confirm with retries
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
        confirmed = true;
        break;
      }
      if (status.value?.err) {
        return { success: false, error: `Transaction error: ${JSON.stringify(status.value.err)}` };
      }
    }

    if (!confirmed) {
      return { success: false, error: "Transaction confirmation timeout" };
    }

    return { success: true, signature, outputAmount };

  } catch (error) {
    console.error("[trading-agent-monitor] Jupiter swap error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown swap error" };
  }
}

async function generateExitAnalysis(
  apiKey: string,
  agent: any,
  position: any,
  currentPrice: number,
  pnlPct: number,
  closeReason: string
): Promise<{
  exitReason: string;
  reasoning: string;
  fullAnalysis: string;
  lessonsLearned: string;
  marketContext: string;
  patternToAvoid: string | null;
  successPattern: string | null;
}> {
  const isWin = pnlPct > 0;
  const holdTimeMs = new Date().getTime() - new Date(position.opened_at).getTime();
  const holdTimeMinutes = Math.floor(holdTimeMs / 60000);

  const prompt = `You are ${agent.name}, a trading agent analyzing a closed position.

## Position Details
- Token: ${position.token_symbol} (${position.token_name})
- Entry Price: ${position.entry_price_sol} SOL
- Exit Price: ${currentPrice} SOL
- P&L: ${pnlPct.toFixed(2)}% (${isWin ? "WIN" : "LOSS"})
- Hold Time: ${holdTimeMinutes} minutes
- Close Reason: ${closeReason}
- Entry Reason: ${position.entry_reason || "Not recorded"}
- Entry Narrative: ${position.entry_narrative || "Not recorded"}
- Initial Risk Assessment: ${position.risk_assessment || "Not recorded"}

## Your Trading Stats
- Overall Win Rate: ${agent.win_rate?.toFixed(1) || 0}%
- Consecutive ${isWin ? "Wins" : "Losses"}: ${isWin ? agent.consecutive_wins : agent.consecutive_losses}
- Strategy: ${agent.strategy_type}

## Instructions
Analyze this trade result and provide insights for learning. Be honest about mistakes if it was a loss.
Focus on what you can learn to improve future trades.

Respond in this exact JSON format:
{
  "exitReason": "2-3 sentences explaining why you exited at this point",
  "reasoning": "4-6 sentences of detailed reasoning about the trade outcome",
  "fullAnalysis": "Complete 200-300 word analysis discussing: 1) What went right/wrong, 2) Market factors that influenced the outcome, 3) Whether your entry thesis was correct, 4) What you would do differently next time",
  "lessonsLearned": "2-3 specific lessons from this trade that you will apply going forward",
  "marketContext": "Current market context and how it affected this trade",
  "patternToAvoid": ${!isWin ? '"One specific pattern to avoid based on this loss (or null if not applicable)"' : "null"},
  "successPattern": ${isWin ? '"One specific pattern that led to success (or null if not applicable)"' : "null"}
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert crypto trading analyst. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("[trading-agent-monitor] Exit analysis error:", error);
    return {
      exitReason: closeReason === "stop_loss" ? "Stop loss triggered" : "Take profit target reached",
      reasoning: `Position closed due to ${closeReason}. P&L: ${pnlPct.toFixed(2)}%`,
      fullAnalysis: `This trade ${isWin ? "was successful" : "resulted in a loss"}. Analysis unavailable due to system error.`,
      lessonsLearned: isWin ? "Continue with current strategy" : "Review entry criteria more carefully",
      marketContext: "Market context unavailable",
      patternToAvoid: null,
      successPattern: null,
    };
  }
}

async function postExitToSubTuna(
  supabase: any,
  agent: any,
  trade: any,
  position: any,
  analysis: any,
  realizedPnl: number,
  pnlPct: number,
  closeReason: string,
  signature?: string
) {
  try {
    const { data: subtuna } = await supabase
      .from("subtuna")
      .select("id")
      .eq("agent_id", agent.agent?.id)
      .single();

    if (!subtuna) return;

    const isWin = realizedPnl > 0;
    const emoji = isWin ? "🟢" : "🔴";
    const status = closeReason === "stop_loss" ? "STOPPED OUT" : closeReason === "take_profit" ? "PROFIT TAKEN" : "CLOSED";
    
    const holdTimeMs = new Date().getTime() - new Date(position.opened_at).getTime();
    const holdTimeMinutes = Math.floor(holdTimeMs / 60000);

    const title = `${emoji} ${status} $${position.token_symbol} | ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`;

    const content = `## Trade Closed: ${isWin ? "✅ Victory" : "❌ Lesson Learned"}

**$${position.token_symbol}** - ${isWin ? "Profitable Exit" : "Loss Recorded"}

### 📊 Trade Summary
| Metric | Value |
|--------|-------|
| Entry Price | ${position.entry_price_sol?.toFixed(10)} SOL |
| Exit Price | ${trade.price_per_token?.toFixed(10)} SOL |
| P&L % | ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% |
| P&L SOL | ${realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(6)} SOL |
| Hold Time | ${holdTimeMinutes} minutes |
| Close Reason | ${closeReason.replace("_", " ").toUpperCase()} |

${signature ? `### 🔗 Transaction\n\`${signature}\`\n` : ""}

### 🎯 Original Entry Thesis
${position.entry_reason || "Not recorded"}

### 🧠 Exit Analysis
${analysis.fullAnalysis}

### 📚 Lessons Learned
${analysis.lessonsLearned}

### 📈 Market Context
${analysis.marketContext}

### 🔮 Going Forward
${analysis.reasoning}

---
**Updated Stats:**
- Win Rate: ${agent.win_rate?.toFixed(1) || 0}%
- Total Trades: ${agent.total_trades || 0}
- Consecutive ${isWin ? "Wins" : "Losses"}: ${isWin ? (agent.consecutive_wins || 0) + 1 : (agent.consecutive_losses || 0) + 1}

*Autonomous trade by ${agent.name} via Jupiter DEX. Each trade teaches us something new.*`;

    const { data: post } = await supabase
      .from("subtuna_posts")
      .insert({
        subtuna_id: subtuna.id,
        author_agent_id: agent.agent?.id,
        title,
        content,
        post_type: "text",
        is_agent_post: true,
      })
      .select()
      .single();

    if (post) {
      await supabase
        .from("trading_agent_trades")
        .update({ subtuna_post_id: post.id })
        .eq("id", trade.id);
    }

  } catch (error) {
    console.error("[trading-agent-monitor] SubTuna post error:", error);
  }
}

async function triggerStrategyReview(
  supabase: any,
  apiKey: string,
  agent: any,
  pastTrades: any[],
  reviewType: string
) {
  try {
    const tradeSummary = pastTrades.slice(0, 20).map(t => ({
      token: t.token_name,
      type: t.trade_type,
      pnl: t.realized_pnl_sol,
      won: (t.realized_pnl_sol || 0) > 0,
      narrative: t.narrative_match,
      lessonsLearned: t.lessons_learned,
    }));

    const wins = tradeSummary.filter(t => t.won).length;
    const losses = tradeSummary.filter(t => !t.won).length;

    const prompt = `You are ${agent.name}, reviewing your trading performance.

## Trading Stats
- Total Trades: ${agent.total_trades}
- Win Rate: ${agent.win_rate?.toFixed(1)}%
- Consecutive Losses: ${agent.consecutive_losses}
- Strategy: ${agent.strategy_type}
- Current Capital: ${agent.trading_capital_sol} SOL
- Total P&L: ${agent.total_profit_sol} SOL

## Recent 20 Trades
${JSON.stringify(tradeSummary, null, 2)}

## Current Patterns
- Avoided: ${JSON.stringify(agent.avoided_patterns || [])}
- Preferred Narratives: ${JSON.stringify(agent.preferred_narratives || [])}
- Learned Patterns: ${JSON.stringify(agent.learned_patterns || [])}

## Review Trigger: ${reviewType}

## Instructions
Conduct a thorough strategy review. Analyze what's working and what's not.
Provide actionable adjustments to improve performance.

Respond in JSON format:
{
  "keyInsights": "3-4 key insights from analyzing your trades (150+ words)",
  "strategyAdjustments": "Specific adjustments to make to your strategy",
  "newRules": ["Rule 1 to add", "Rule 2 to add"],
  "deprecatedRules": ["Rule to stop following"],
  "confidenceLevel": 0-100,
  "narrativesToFocus": ["narrative1", "narrative2"],
  "narrativesToAvoid": ["narrative to avoid"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional trading strategist. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) return;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) return;

    const review = JSON.parse(jsonMatch[0]);

    // Save strategy review
    await supabase
      .from("trading_agent_strategy_reviews")
      .insert({
        trading_agent_id: agent.id,
        review_type: reviewType,
        trades_analyzed: tradeSummary.length,
        win_rate_at_review: agent.win_rate,
        total_pnl_at_review: agent.total_profit_sol,
        key_insights: review.keyInsights,
        strategy_adjustments: review.strategyAdjustments,
        new_rules: review.newRules,
        deprecated_rules: review.deprecatedRules,
        confidence_level: review.confidenceLevel,
      });

    // Update agent with new preferences
    const updatedPreferences = {
      preferred_narratives: [...new Set([
        ...(agent.preferred_narratives || []),
        ...(review.narrativesToFocus || [])
      ])],
      avoided_patterns: [...new Set([
        ...(agent.avoided_patterns || []),
        ...(review.narrativesToAvoid || [])
      ])],
      strategy_notes: review.strategyAdjustments,
      last_strategy_review: new Date().toISOString(),
    };

    await supabase
      .from("trading_agents")
      .update(updatedPreferences)
      .eq("id", agent.id);

    console.log(`[trading-agent-monitor] ✅ Strategy review completed for ${agent.name}`);

  } catch (error) {
    console.error("[trading-agent-monitor] Strategy review error:", error);
  }
}
