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

// Jupiter Trigger (Limit Order) API
const JUPITER_TRIGGER_URL = 'https://api.jup.ag/trigger/v1';

// High-frequency polling configuration
const MAX_RUNTIME_MS = 55000; // 55 seconds (leave 5s buffer for Edge Function timeout)
const POLL_INTERVAL_MS = 5000; // 5 seconds between checks for fast SL reaction

// Jupiter API V1 endpoint (V6 is deprecated/sunset)
const JUPITER_BASE_URL = 'https://api.jup.ag/swap/v1';

// Jito Block Engines for MEV-protected execution
const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

// Fetch with exponential backoff retry logic
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
      console.warn(`[trading-agent-monitor] Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('All fetch retries exhausted');
}

// Get Jupiter quote (V1 API with x-api-key)
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<{ quote: any } | null> {
  const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
  if (!jupiterApiKey) {
    console.error("[trading-agent-monitor] JUPITER_API_KEY not configured");
    return null;
  }

  try {
    const quoteUrl = `${JUPITER_BASE_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const response = await fetchWithRetry(quoteUrl, {
      headers: { 'x-api-key': jupiterApiKey }
    });
    if (response.ok) {
      const quote = await response.json();
      return { quote };
    }
    const errorText = await response.text();
    console.warn(`[trading-agent-monitor] Jupiter quote returned ${response.status}: ${errorText}`);
    return null;
  } catch (e) {
    console.error(`[trading-agent-monitor] Jupiter quote failed:`, e);
    return null;
  }
}

// Get Jupiter swap transaction (V1 API with x-api-key)
async function getJupiterSwapTx(
  quote: any,
  userPublicKey: string
): Promise<{ swapTransaction: string } | null> {
  const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
  if (!jupiterApiKey) {
    console.error("[trading-agent-monitor] JUPITER_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetchWithRetry(`${JUPITER_BASE_URL}/swap`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": jupiterApiKey
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
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
    if (response.ok) {
      return await response.json();
    }
    const errorText = await response.text();
    console.warn(`[trading-agent-monitor] Jupiter swap returned ${response.status}: ${errorText}`);
    return null;
  } catch (e) {
    console.error(`[trading-agent-monitor] Jupiter swap failed:`, e);
    return null;
  }
}

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
            wallet_private_key_encrypted, wallet_address,
            agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url)
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

          // === ON-CHAIN ORDER MONITORING: Both TP and SL via Jupiter Trigger Orders ===
          const hasTPOrder = position.limit_order_tp_pubkey && position.limit_order_tp_status === 'active';
          const hasSLOrder = position.limit_order_sl_pubkey && position.limit_order_sl_status === 'active';
          const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");
          const agentWalletAddress = agent.wallet_address || position.trading_agent?.wallet_address;

          if (!jupiterApiKey || !agentWalletAddress) {
            console.warn(`[trading-agent-monitor] Missing Jupiter API key or wallet address for ${agent.name}`);
            continue;
          }

          // Check TP order status
          if (hasTPOrder) {
            const tpStatus = await checkJupiterOrderStatus(position.limit_order_tp_pubkey, agentWalletAddress, jupiterApiKey);
            if (tpStatus === 'filled') {
              console.log(`[trading-agent-monitor] TP order FILLED for ${position.token_symbol}`);
              await supabase.from("trading_agent_positions").update({ limit_order_tp_status: 'filled' }).eq("id", position.id);

              // Cancel the SL order since TP filled
              if (hasSLOrder) {
                try {
                  const agentKeypair = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
                  if (agentKeypair) {
                    await cancelJupiterLimitOrder(connection, agentKeypair, jupiterApiKey, position.limit_order_sl_pubkey);
                    await supabase.from("trading_agent_positions").update({ limit_order_sl_status: 'cancelled' }).eq("id", position.id);
                    console.log(`[trading-agent-monitor] Cancelled SL order after TP fill`);
                  }
                } catch (cancelErr) {
                  console.warn(`[trading-agent-monitor] Failed to cancel SL order after TP fill:`, cancelErr);
                }
              }

              const solReceived = position.investment_sol * (1 + strategy.takeProfit / 100);
              const realizedPnl = solReceived - position.investment_sol;

              await processPositionClosure(
                supabase, connection, LOVABLE_API_KEY, API_ENCRYPTION_KEY,
                agent, position, currentPrice, pnlPct, "take_profit",
                solReceived, realizedPnl, "jupiter-trigger-order"
              );

              results.push({
                positionId: position.id,
                agentName: agent.name,
                token: position.token_symbol,
                closeReason: "take_profit",
                pnlPct: pnlPct.toFixed(2),
                realizedPnl: realizedPnl.toFixed(6),
                signature: "jupiter-trigger-order",
              });

              closedCount++;
              takeProfitCount++;
              totalTrades++;
              console.log(`[trading-agent-monitor] ✅ ${agent.name} closed ${position.token_symbol} via TP order (${pnlPct.toFixed(2)}%)`);
              continue;
            } else if (tpStatus === 'cancelled') {
              await supabase.from("trading_agent_positions").update({ limit_order_tp_status: 'cancelled' }).eq("id", position.id);
            }
          }

          // Check SL order status
          if (hasSLOrder) {
            const slStatus = await checkJupiterOrderStatus(position.limit_order_sl_pubkey, agentWalletAddress, jupiterApiKey);
            if (slStatus === 'filled') {
              console.log(`[trading-agent-monitor] SL order FILLED for ${position.token_symbol}`);
              await supabase.from("trading_agent_positions").update({ limit_order_sl_status: 'filled' }).eq("id", position.id);

              // Cancel the TP order since SL filled
              if (hasTPOrder) {
                try {
                  const agentKeypair = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
                  if (agentKeypair) {
                    await cancelJupiterLimitOrder(connection, agentKeypair, jupiterApiKey, position.limit_order_tp_pubkey);
                    await supabase.from("trading_agent_positions").update({ limit_order_tp_status: 'cancelled' }).eq("id", position.id);
                    console.log(`[trading-agent-monitor] Cancelled TP order after SL fill`);
                  }
                } catch (cancelErr) {
                  console.warn(`[trading-agent-monitor] Failed to cancel TP order after SL fill:`, cancelErr);
                }
              }

              const solReceived = position.investment_sol * (1 - strategy.stopLoss / 100);
              const realizedPnl = solReceived - position.investment_sol;

              await processPositionClosure(
                supabase, connection, LOVABLE_API_KEY, API_ENCRYPTION_KEY,
                agent, position, currentPrice, pnlPct, "stop_loss",
                solReceived, realizedPnl, "jupiter-trigger-order"
              );

              results.push({
                positionId: position.id,
                agentName: agent.name,
                token: position.token_symbol,
                closeReason: "stop_loss",
                pnlPct: pnlPct.toFixed(2),
                realizedPnl: realizedPnl.toFixed(6),
                signature: "jupiter-trigger-order",
              });

              closedCount++;
              stopLossCount++;
              totalTrades++;
              console.log(`[trading-agent-monitor] ✅ ${agent.name} closed ${position.token_symbol} via SL order (${pnlPct.toFixed(2)}%)`);
              continue;
            } else if (slStatus === 'cancelled') {
              await supabase.from("trading_agent_positions").update({ limit_order_sl_status: 'cancelled' }).eq("id", position.id);
            }
          }

          // === FALLBACK: DB-based monitoring if no on-chain orders exist ===
          // This handles legacy positions or cases where order placement failed
          if (!hasTPOrder && !hasSLOrder) {
            const hitStopLoss = pnlPct <= -strategy.stopLoss;
            const hitTakeProfit = pnlPct >= strategy.takeProfit;

            if (hitStopLoss || hitTakeProfit) {
              const closeReason = hitStopLoss ? "stop_loss" : "take_profit";

              const agentKeypair = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
              if (!agentKeypair) {
                console.error(`[trading-agent-monitor] Failed to decrypt wallet for ${agent.name}`);
                continue;
              }

              // Fetch on-chain token balance
              const { PublicKey: PubKey } = await import("https://esm.sh/@solana/web3.js@1.98.0");
              const TOKEN_2022_PROGRAM = new PubKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
              const mintPubkey = new PubKey(position.token_address);
              const [splAccounts, t22Accounts] = await Promise.all([
                connection.getParsedTokenAccountsByOwner(
                  agentKeypair.publicKey, { mint: mintPubkey }
                ).catch(() => ({ value: [] })),
                connection.getParsedTokenAccountsByOwner(
                  agentKeypair.publicKey, 
                  { programId: TOKEN_2022_PROGRAM }
                ).then(res => ({
                  value: res.value.filter(a => 
                    a.account.data.parsed?.info?.mint === position.token_address
                  )
                })).catch(() => ({ value: [] })),
              ]);
              const allTokenAccounts = [...splAccounts.value, ...t22Accounts.value];
              let amountToSell = 0;
              for (const acc of allTokenAccounts) {
                const raw = acc.account.data.parsed?.info?.tokenAmount?.amount;
                if (raw) amountToSell += parseInt(raw);
              }
              if (amountToSell === 0) {
                console.warn(`[trading-agent-monitor] No on-chain balance for ${position.token_symbol}, marking as sell_failed`);
                await supabase.from("trading_agent_positions").update({ status: "sell_failed" }).eq("id", position.id);
                continue;
              }

              const swapResult = await executeJupiterSwapWithJito(
                connection, agentKeypair,
                position.token_address, WSOL_MINT,
                amountToSell, SLIPPAGE_BPS
              );

              if (!swapResult.success) {
                console.error(`[trading-agent-monitor] Sell swap failed for ${agent.name}:`, swapResult.error);
                await supabase.from("trading_agent_positions").update({ status: "sell_failed" }).eq("id", position.id);
                continue;
              }

              const solReceived = (swapResult.outputAmount || currentValue);
              const minAcceptableSol = position.investment_sol * 0.01;
              if (solReceived < minAcceptableSol) {
                console.error(`[trading-agent-monitor] ⚠️ DUST SELL for ${position.token_symbol}: received ${solReceived.toFixed(9)} SOL. Marking as sell_failed.`);
                await supabase.from("trading_agent_positions").update({ 
                  status: "sell_failed",
                  current_value_sol: solReceived,
                }).eq("id", position.id);
                continue;
              }

              const realizedPnl = solReceived - position.investment_sol;

              await processPositionClosure(
                supabase, connection, LOVABLE_API_KEY, API_ENCRYPTION_KEY,
                agent, position, currentPrice, pnlPct, closeReason,
                solReceived, realizedPnl, swapResult.signature || ""
              );

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
              totalTrades++;

              console.log(`[trading-agent-monitor] ✅ ${agent.name} closed ${position.token_symbol} via fallback: ${closeReason} (${pnlPct.toFixed(2)}%)`);
            }
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

// NOTE: Deprecated executeJupiterSwap (V6) removed. Use executeJupiterSwapWithJito (V1) instead.

async function fetchTokenPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  try {
    // Fetch real SOL price first
    const solPrice = await fetchSolPrice();
    console.log(`[trading-agent-monitor] Using SOL price: $${solPrice.toFixed(2)}`);

    for (const address of tokenAddresses) {
      // 1. Try Jupiter V2 Price API (current working version)
      try {
        const response = await fetch(`https://api.jup.ag/price/v2?ids=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.[address]?.price) {
            const usdPrice = parseFloat(data.data[address].price);
            if (!isNaN(usdPrice) && usdPrice > 0) {
              priceMap.set(address, usdPrice / solPrice);
              console.log(`[trading-agent-monitor] Jupiter V2 price for ${address.slice(0,8)}: ${(usdPrice / solPrice).toExponential(4)} SOL`);
              continue;
            }
          }
        }
      } catch {
        // Fall through to DexScreener
      }

      // 2. Try DexScreener API (reliable for pump.fun / Meteora tokens)
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.pairs && data.pairs.length > 0) {
            // Get the most liquid pair
            const pair = data.pairs.sort((a: any, b: any) =>
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            // priceNative is SOL-denominated for Solana pairs
            const priceNative = parseFloat(pair.priceNative);
            if (!isNaN(priceNative) && priceNative > 0) {
              priceMap.set(address, priceNative);
              console.log(`[trading-agent-monitor] DexScreener price for ${address.slice(0,8)}: ${priceNative.toExponential(4)} SOL`);
              continue;
            }
          }
        }
      } catch {
        // Fall through to pump.fun
      }

      // 3. Fallback: pump.fun API (for pre-graduation tokens)
      try {
        const response = await fetch(`https://frontend-api.pump.fun/coins/${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.virtual_sol_reserves && data.virtual_token_reserves) {
            const priceSol = (data.virtual_sol_reserves / 1e9) / (data.virtual_token_reserves / 1e6);
            priceMap.set(address, priceSol);
            console.log(`[trading-agent-monitor] pump.fun price for ${address.slice(0,8)}: ${priceSol.toExponential(4)} SOL`);
            continue;
          }
        }
      } catch {
        // No more fallbacks
      }

      console.warn(`[trading-agent-monitor] ⚠️ No price found for token ${address.slice(0,8)}... from any source`);
    }
  } catch (error) {
    console.error("[trading-agent-monitor] Price fetch error:", error);
  }
  
  return priceMap;
}

// Fetch real SOL price from multiple sources
async function fetchSolPrice(): Promise<number> {
  // Try Jupiter V2 first (current working version)
  try {
    const response = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    if (response.ok) {
      const data = await response.json();
      const priceStr = data.data?.['So11111111111111111111111111111111111111112']?.price;
      const price = priceStr ? parseFloat(priceStr) : 0;
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  } catch (e) {
    console.warn('[trading-agent-monitor] Jupiter V2 SOL price fetch failed');
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
    // Get quote from Jupiter V1 API
    const quoteResult = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);
    
    if (!quoteResult) {
      return { success: false, error: "Jupiter quote failed" };
    }

    const { quote } = quoteResult;
    const outputAmount = parseInt(quote.outAmount) / 1e9; // SOL has 9 decimals

    // Get swap transaction from Jupiter V1 API
    const swapData = await getJupiterSwapTx(quote, payer.publicKey.toBase58());

    if (!swapData) {
      return { success: false, error: "Jupiter swap failed" };
    }
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

// === Jupiter Limit Order Helper Functions ===

async function checkJupiterOrderStatus(orderPubkey: string, walletAddress: string, jupiterApiKey: string): Promise<'active' | 'filled' | 'cancelled' | 'unknown'> {
  try {
    // FIXED: Query by wallet address (user), NOT order pubkey
    // Jupiter's getTriggerOrders expects the wallet address as the `user` param
    const response = await fetchWithRetry(
      `${JUPITER_TRIGGER_URL}/getTriggerOrders?user=${walletAddress}&orderStatus=active`,
      { headers: { 'x-api-key': jupiterApiKey } }
    );

    if (!response.ok) {
      console.warn(`[trading-agent-monitor] getTriggerOrders failed for wallet ${walletAddress}: ${response.status}`);
      return 'unknown';
    }

    const data = await response.json();
    
    // Search returned orders for our specific order pubkey
    const orders = data.orders || data;
    if (Array.isArray(orders)) {
      const order = orders.find((o: any) => o.account === orderPubkey || o.orderKey === orderPubkey || o.publicKey === orderPubkey);
      if (order) {
        if (order.status === 'completed' || order.status === 'filled') return 'filled';
        if (order.status === 'cancelled') return 'cancelled';
        return 'active';
      }
    }

    // If order not found in active list, check history (it may have been filled/cancelled)
    const historyResponse = await fetchWithRetry(
      `${JUPITER_TRIGGER_URL}/getTriggerOrders?user=${walletAddress}&orderStatus=history`,
      { headers: { 'x-api-key': jupiterApiKey } }
    );

    if (historyResponse.ok) {
      const histData = await historyResponse.json();
      const histOrders = histData.orders || histData;
      if (Array.isArray(histOrders)) {
        const histOrder = histOrders.find((o: any) => o.account === orderPubkey || o.orderKey === orderPubkey || o.publicKey === orderPubkey);
        if (histOrder) {
          if (histOrder.status === 'completed' || histOrder.status === 'filled') return 'filled';
          if (histOrder.status === 'cancelled') return 'cancelled';
        }
      }
    }

    return 'unknown';
  } catch (error) {
    console.error(`[trading-agent-monitor] checkJupiterOrderStatus error:`, error);
    return 'unknown';
  }
}

async function cancelJupiterLimitOrder(
  connection: Connection,
  payer: Keypair,
  jupiterApiKey: string,
  orderPubkey: string
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(`${JUPITER_TRIGGER_URL}/cancelOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': jupiterApiKey,
      },
      body: JSON.stringify({
        maker: payer.publicKey.toBase58(),
        order: orderPubkey,
        computeUnitPrice: "auto",
      }),
    });

    if (!response.ok) {
      console.warn(`[trading-agent-monitor] cancelOrder failed: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const txBase64 = data.transaction;
    if (!txBase64) return false;

    const txBuf = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(txBuf);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.message.recentBlockhash = blockhash;
    transaction.sign([payer]);

    // Execute via Jupiter
    const signedTxBase64 = btoa(String.fromCharCode(...transaction.serialize()));
    const execResponse = await fetchWithRetry(`${JUPITER_TRIGGER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': jupiterApiKey },
      body: JSON.stringify({ signedTransaction: signedTxBase64 }),
    });

    if (execResponse.ok) {
      console.log(`[trading-agent-monitor] ✅ Cancelled limit order: ${orderPubkey}`);
      return true;
    }

    // Fallback: send directly
    const sig = await connection.sendTransaction(transaction, { skipPreflight: true, maxRetries: 3 });
    console.log(`[trading-agent-monitor] ✅ Cancelled limit order via direct send: ${sig}`);
    return true;
  } catch (error) {
    console.error(`[trading-agent-monitor] cancelJupiterLimitOrder error:`, error);
    return false;
  }
}

// Shared function to process position closure (used by both limit order and DB-based paths)
async function processPositionClosure(
  supabase: any,
  connection: Connection,
  lovableApiKey: string,
  apiEncryptionKey: string,
  agent: any,
  position: any,
  currentPrice: number,
  pnlPct: number,
  closeReason: string,
  solReceived: number,
  realizedPnl: number,
  signature: string
) {
  const exitAnalysis = await generateExitAnalysis(
    lovableApiKey, agent, position, currentPrice, pnlPct, closeReason
  );

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

  // Find the matching buy trade to get buy_signature
  const { data: buyTrade } = await supabase
    .from("trading_agent_trades")
    .select("signature")
    .eq("position_id", position.id)
    .eq("trade_type", "buy")
    .single();

  // Verify actual SOL received on-chain via Helius for accurate PNL
  let verifiedPnl: number | null = null;
  let verifiedSolReceived: number | null = null;
  const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");
  if (heliusRpcUrl && signature) {
    try {
      const txResp = await fetch(heliusRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        }),
      });
      const txResult = await txResp.json();
      if (txResult?.result?.meta) {
        const meta = txResult.result.meta;
        const accountKeys = txResult.result.transaction?.message?.accountKeys || [];
        // Find agent wallet index in accounts
        const agentWallet = agent.wallet_address;
        let walletIdx = -1;
        for (let i = 0; i < accountKeys.length; i++) {
          const key = typeof accountKeys[i] === 'string' ? accountKeys[i] : accountKeys[i]?.pubkey;
          if (key === agentWallet) { walletIdx = i; break; }
        }
        if (walletIdx >= 0 && meta.preBalances && meta.postBalances) {
          const preBalance = meta.preBalances[walletIdx];
          const postBalance = meta.postBalances[walletIdx];
          // SOL change = (post - pre) in lamports, positive means received SOL
          const solChange = (postBalance - preBalance) / 1e9;
          // Add back the fee since it's a cost of the tx, not part of trading PNL
          const txFee = (meta.fee || 0) / 1e9;
          verifiedSolReceived = solChange + txFee;
          verifiedPnl = verifiedSolReceived - position.investment_sol;
          console.log(`[monitor] ✅ Helius verified PNL: invested=${position.investment_sol} received=${verifiedSolReceived.toFixed(6)} pnl=${verifiedPnl.toFixed(6)}`);
        }
      }
    } catch (e) {
      console.warn(`[monitor] Helius PNL verification failed, using estimate:`, e);
    }
  }

  // Use verified values if available, otherwise fall back to estimates
  const finalSolReceived = verifiedSolReceived ?? solReceived;
  const finalPnl = verifiedPnl ?? realizedPnl;

  // Create sell trade record
  const { data: trade } = await supabase
    .from("trading_agent_trades")
    .insert({
      trading_agent_id: agent.id,
      position_id: position.id,
      token_address: position.token_address,
      token_name: position.token_name,
      trade_type: "sell",
      amount_sol: finalSolReceived,
      amount_tokens: position.amount_tokens,
      price_per_token: currentPrice,
      strategy_used: agent.strategy_type,
      exit_analysis: exitAnalysis.fullAnalysis,
      ai_reasoning: exitAnalysis.reasoning,
      lessons_learned: exitAnalysis.lessonsLearned,
      market_context: exitAnalysis.marketContext,
      status: "success",
      signature,
      buy_signature: buyTrade?.signature || null,
      verified_pnl_sol: verifiedPnl,
      verified_at: verifiedPnl !== null ? new Date().toISOString() : null,
    })
    .select()
    .single();

  // Update position with verified PNL if available
  if (verifiedPnl !== null) {
    await supabase
      .from("trading_agent_positions")
      .update({ realized_pnl_sol: finalPnl })
      .eq("id", position.id);
  }

  // Update agent stats
  const isWin = finalPnl > 0;
  const newWinningTrades = (agent.winning_trades || 0) + (isWin ? 1 : 0);
  const newLosingTrades = (agent.losing_trades || 0) + (isWin ? 0 : 1);
  const newTotalTrades = (agent.total_trades || 0) + 1;
  const newWinRate = newTotalTrades > 0 ? (newWinningTrades / newTotalTrades) * 100 : 0;

  const consecutiveWins = isWin ? (agent.consecutive_wins || 0) + 1 : 0;
  const consecutiveLosses = isWin ? 0 : (agent.consecutive_losses || 0) + 1;

  const bestTrade = Math.max(agent.best_trade_sol || 0, isWin ? finalPnl : 0);
  const worstTrade = Math.min(agent.worst_trade_sol || 0, isWin ? 0 : finalPnl);

  const holdTimeMs = new Date().getTime() - new Date(position.opened_at).getTime();
  const holdTimeMinutes = Math.floor(holdTimeMs / 60000);
  const avgHoldTime = agent.avg_hold_time_minutes
    ? Math.floor((agent.avg_hold_time_minutes + holdTimeMinutes) / 2)
    : holdTimeMinutes;

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
      trading_capital_sol: (agent.trading_capital_sol || 0) + finalSolReceived,
      total_profit_sol: (agent.total_profit_sol || 0) + finalPnl,
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

  if (trade) {
    await postExitToSubTuna(
      supabase, agent, trade, position, exitAnalysis,
      realizedPnl, pnlPct, closeReason, signature
    );
  }

  if (consecutiveLosses >= 3 || newTotalTrades % 10 === 0) {
    await triggerStrategyReview(
      supabase, lovableApiKey, agent,
      pastTrades || [],
      consecutiveLosses >= 3 ? "after_loss" : "periodic"
    );
  }
}
