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
  conservative: { stopLoss: 10, takeProfit: 25, positionPct: 10, maxPositions: 2 },
  balanced: { stopLoss: 20, takeProfit: 50, positionPct: 15, maxPositions: 2 },
  aggressive: { stopLoss: 30, takeProfit: 100, positionPct: 25, maxPositions: 2 },
};

const MIN_CAPITAL_SOL = 0.5;
const GAS_RESERVE_SOL = 0.1;
const MIN_LIQUIDITY_SOL = 20;
const COOLDOWN_SECONDS = 60;
const SLIPPAGE_BPS = 500; // 5%
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Jupiter Trigger (Limit Order) API
const JUPITER_TRIGGER_URL = 'https://api.jup.ag/trigger/v1';

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
      console.warn(`[trading-agent-execute] Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms...`);
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
    console.error("[trading-agent-execute] JUPITER_API_KEY not configured");
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
    console.warn(`[trading-agent-execute] Jupiter quote returned ${response.status}: ${errorText}`);
    return null;
  } catch (e) {
    console.error(`[trading-agent-execute] Jupiter quote failed:`, e);
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
    console.error("[trading-agent-execute] JUPITER_API_KEY not configured");
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
    console.warn(`[trading-agent-execute] Jupiter swap returned ${response.status}: ${errorText}`);
    return null;
  } catch (e) {
    console.error(`[trading-agent-execute] Jupiter swap failed:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[trading-agent-execute] Starting trade execution cycle...");

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

    // Get active trading agents with sufficient capital
    const { data: agents, error: agentsError } = await supabase
      .from("trading_agents")
      .select(`
        *,
        agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url)
      `)
      .eq("status", "active")
      .gte("trading_capital_sol", MIN_CAPITAL_SOL);

    // === BUG FIX: Sync on-chain balance before trading ===
    if (agents && agents.length > 0) {
      for (const agent of agents) {
        try {
          const agentKp = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
          if (!agentKp) continue;
          const actualBalance = await connection.getBalance(agentKp.publicKey) / 1e9;
          const dbCapital = agent.trading_capital_sol || 0;
          if (Math.abs(actualBalance - dbCapital) > 0.05) {
            console.warn(`[trading-agent-execute] Balance mismatch for ${agent.name}: DB=${dbCapital.toFixed(4)}, Chain=${actualBalance.toFixed(4)}. Syncing.`);
            await supabase.from("trading_agents").update({ trading_capital_sol: actualBalance }).eq("id", agent.id);
            agent.trading_capital_sol = actualBalance; // update in-memory too
          }
        } catch (syncErr) {
          console.warn(`[trading-agent-execute] Balance sync failed for ${agent.name}:`, syncErr);
        }
      }
    }

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active trading agents with sufficient capital" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[trading-agent-execute] Found ${agents.length} active trading agents`);

    const results: any[] = [];

    // Narrative categories for inline scoring
    const NARRATIVES = [
      { keywords: ["pepe", "frog", "kek", "wojak", "meme"], category: "meme", weight: 1.2 },
      { keywords: ["ai", "gpt", "agent", "bot", "neural"], category: "ai", weight: 1.3 },
      { keywords: ["dog", "shib", "inu", "doge", "puppy"], category: "dog", weight: 1.1 },
      { keywords: ["cat", "kitty", "meow", "nyan"], category: "cat", weight: 1.1 },
      { keywords: ["trump", "biden", "elon", "musk"], category: "politics", weight: 1.4 },
      { keywords: ["solana", "sol", "phantom"], category: "solana", weight: 1.0 },
      { keywords: ["moon", "rocket", "mars", "space"], category: "space", weight: 1.0 },
      { keywords: ["game", "gaming", "play", "pixel"], category: "gaming", weight: 1.1 },
    ];

    // Inline function to score pump.fun tokens
    function scoreToken(token: any): any | null {
      try {
        const now = Date.now();
        const createdAt = new Date(token.created_timestamp || now).getTime();
        const ageHours = (now - createdAt) / (1000 * 60 * 60);
        const liquiditySol = (token.virtual_sol_reserves || 0) / 1e9;
        const holderCount = token.holder_count || 0;
        const replyCount = token.reply_count || 0;

        let score = 0;

        // Liquidity score (25 points max)
        if (liquiditySol >= 50) score += 25;
        else if (liquiditySol >= 30) score += 20;
        else if (liquiditySol >= 20) score += 15;
        else if (liquiditySol >= 10) score += 10;
        else if (liquiditySol >= 5) score += 5;

        // Holder count score (15 points max)
        if (holderCount >= 100) score += 15;
        else if (holderCount >= 50) score += 12;
        else if (holderCount >= 25) score += 8;
        else if (holderCount >= 10) score += 5;

        // Age sweet spot score (10 points max) - prefer 1-6 hours old
        if (ageHours >= 1 && ageHours <= 6) score += 10;
        else if (ageHours > 6 && ageHours <= 12) score += 7;
        else if (ageHours > 12 && ageHours <= 24) score += 4;
        else if (ageHours < 1) score += 3;

        // King of the Hill bonus (10 points)
        if (token.king_of_the_hill_timestamp) score += 10;

        // Narrative matching (20 points max)
        const nameAndDesc = `${token.name} ${token.symbol} ${token.description || ""}`.toLowerCase();
        let narrativeCategory = "other";
        let narrativeWeight = 1.0;
        for (const narrative of NARRATIVES) {
          if (narrative.keywords.some(kw => nameAndDesc.includes(kw))) {
            narrativeCategory = narrative.category;
            narrativeWeight = narrative.weight;
            score += 20;
            break;
          }
        }

        // Volume trend (20 points max)
        if (replyCount >= 50) score += 20;
        else if (replyCount >= 25) score += 15;
        else if (replyCount >= 10) score += 10;
        else if (replyCount >= 5) score += 5;

        score = Math.min(100, Math.round(score * narrativeWeight));

        if (score < 60 || liquiditySol < MIN_LIQUIDITY_SOL) return null;

        const priceSol = token.virtual_sol_reserves && token.virtual_token_reserves
          ? (token.virtual_sol_reserves / 1e9) / (token.virtual_token_reserves / 1e6)
          : 0;

        return {
          mint_address: token.mint,
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          image_url: token.image_uri,
          price_sol: priceSol,
          liquidity_sol: liquiditySol,
          holder_count: holderCount,
          age_hours: ageHours,
          token_score: score,
          narrative_category: narrativeCategory,
          volume_trend: replyCount >= 25 ? "rising" : replyCount >= 10 ? "stable" : "low",
          is_king_of_hill: !!token.king_of_the_hill_timestamp,
          reply_count: replyCount,
        };
      } catch {
        return null;
      }
    }

    for (const agent of agents) {
      try {
        // Check cooldown
        const lastTradeTime = agent.last_trade_at ? new Date(agent.last_trade_at).getTime() : 0;
        const cooldownEnd = lastTradeTime + COOLDOWN_SECONDS * 1000;
        if (Date.now() < cooldownEnd) {
          console.log(`[trading-agent-execute] Agent ${agent.name} in cooldown`);
          continue;
        }

        // Get current open positions
        const { data: openPositions } = await supabase
          .from("trading_agent_positions")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .eq("status", "open");

        const strategy = STRATEGIES[agent.strategy_type as keyof typeof STRATEGIES] || STRATEGIES.balanced;
        const openCount = openPositions?.length || 0;

        if (openCount >= strategy.maxPositions) {
          console.log(`[trading-agent-execute] Agent ${agent.name} at max positions (${openCount}/${strategy.maxPositions})`);
          continue;
        }

        // Get past trades for AI learning context
        const { data: pastTrades } = await supabase
          .from("trading_agent_trades")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(10);

        // Get strategy reviews
        const { data: recentReviews } = await supabase
          .from("trading_agent_strategy_reviews")
          .select("*")
          .eq("trading_agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(3);

        const existingTokens = new Set(openPositions?.map(p => p.token_address) || []);

        // === ON-DEMAND TOKEN DISCOVERY via DexScreener ===
        // Fetches latest Solana token profiles + boosted tokens, filters < 1 hour old
        const DISCOVERY_MAX_MS = 30000;
        const DISCOVERY_POLL_MS = 10000;
        const discoveryStart = Date.now();
        let availableTokens: any[] = [];
        let discoveryAttempt = 0;
        const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

        while (Date.now() - discoveryStart < DISCOVERY_MAX_MS) {
          discoveryAttempt++;
          console.log(`[trading-agent-execute] Agent ${agent.name} DexScreener discovery attempt #${discoveryAttempt}...`);

          try {
            // Fetch latest token profiles (new listings) and boosted tokens in parallel
            const [profilesResp, boostsResp] = await Promise.all([
              fetch("https://api.dexscreener.com/token-profiles/latest/v1"),
              fetch("https://api.dexscreener.com/token-boosts/top/v1"),
            ]);

            const allMints = new Set<string>();
            const tokenMeta = new Map<string, { name?: string; symbol?: string; description?: string; imageUrl?: string; url?: string; boostAmount?: number }>();

            // Process latest token profiles - filter Solana only
            if (profilesResp.ok) {
              const profiles = await profilesResp.json();
              for (const p of profiles) {
                if (p.chainId !== "solana" || !p.tokenAddress) continue;
                allMints.add(p.tokenAddress);
                tokenMeta.set(p.tokenAddress, {
                  description: p.description || "",
                  imageUrl: p.icon || "",
                  url: p.url || "",
                });
              }
              console.log(`[trading-agent-execute] Got ${allMints.size} Solana tokens from profiles`);
            }

            // Process boosted tokens - Solana only
            if (boostsResp.ok) {
              const boosts = await boostsResp.json();
              for (const b of boosts) {
                if (b.chainId !== "solana" || !b.tokenAddress) continue;
                allMints.add(b.tokenAddress);
                const existing = tokenMeta.get(b.tokenAddress) || {};
                tokenMeta.set(b.tokenAddress, {
                  ...existing,
                  description: existing.description || b.description || "",
                  imageUrl: existing.imageUrl || b.icon || "",
                  url: existing.url || b.url || "",
                  boostAmount: (b.totalAmount || 0),
                });
              }
              console.log(`[trading-agent-execute] Total unique Solana mints: ${allMints.size}`);
            }

            if (allMints.size === 0) {
              console.log(`[trading-agent-execute] No Solana tokens from DexScreener, retrying...`);
            } else {
              // Batch fetch pair data from DexScreener (max 30 per request)
              const mintArray = [...allMints];
              const rawTokens: any[] = [];

              for (let i = 0; i < mintArray.length; i += 30) {
                const chunk = mintArray.slice(i, i + 30);
                const pairsResp = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
                if (!pairsResp.ok) {
                  console.warn(`[trading-agent-execute] DexScreener pairs returned ${pairsResp.status}`);
                  continue;
                }
                const pairs = await pairsResp.json();

                // Group pairs by base token, pick best liquidity pair per token
                const bestPairByMint = new Map<string, any>();
                for (const pair of pairs) {
                  if (!pair.baseToken?.address) continue;
                  const mint = pair.baseToken.address;
                  const existing = bestPairByMint.get(mint);
                  if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
                    bestPairByMint.set(mint, pair);
                  }
                }

                for (const [mint, pair] of bestPairByMint) {
                  const pairCreatedAt = pair.pairCreatedAt || 0;
                  const ageMs = Date.now() - pairCreatedAt;

                  // STRICT: Skip tokens older than 1 hour
                  if (ageMs > MAX_AGE_MS) continue;

                  const liquidityUsd = pair.liquidity?.usd || 0;
                  const volume24h = pair.volume?.h24 || 0;
                  const priceUsd = parseFloat(pair.priceUsd || "0");
                  const meta = tokenMeta.get(mint) || {};

                  // Get SOL price from the pair if available
                  const solPriceFromPair = pair.quoteToken?.symbol === "SOL" && parseFloat(pair.priceNative || "0") > 0
                    ? priceUsd / parseFloat(pair.priceNative)
                    : 150;

                  const liquiditySol = liquidityUsd / solPriceFromPair;
                  const priceSol = priceUsd / solPriceFromPair;

                  rawTokens.push({
                    mint,
                    name: pair.baseToken.name || "Unknown",
                    symbol: pair.baseToken.symbol || "???",
                    description: meta.description || "",
                    image_uri: meta.imageUrl || pair.info?.imageUrl || "",
                    virtual_sol_reserves: liquiditySol * 1e9,
                    virtual_token_reserves: 1e12,
                    holder_count: pair.txns?.h1?.buys || 0,
                    reply_count: (pair.txns?.h1?.buys || 0) + (pair.txns?.h1?.sells || 0),
                    created_timestamp: pairCreatedAt,
                    king_of_the_hill_timestamp: (meta.boostAmount || 0) > 100 ? Date.now() : null,
                  });
                }

                // Small delay between chunks to avoid rate limiting
                if (i + 30 < mintArray.length) {
                  await new Promise(r => setTimeout(r, 200));
                }
              }

              console.log(`[trading-agent-execute] ${rawTokens.length} tokens under 1h old from DexScreener`);

              // Score and filter tokens
              const scoredTokens = rawTokens
                .map(scoreToken)
                .filter(Boolean)
                .filter(t => !existingTokens.has(t.mint_address));

              // Race condition protection - skip tokens traded in last 5 min
              const recentTradeChecks = await Promise.all(
                scoredTokens.map(async (t) => {
                  const { data: lastTrade } = await supabase
                    .from("trading_agent_trades")
                    .select("created_at")
                    .eq("trading_agent_id", agent.id)
                    .eq("token_address", t.mint_address)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (lastTrade && Date.now() - new Date(lastTrade.created_at).getTime() < 300000) {
                    return null;
                  }
                  return t;
                })
              );
              availableTokens = recentTradeChecks.filter(Boolean);

              if (availableTokens.length > 0) {
                console.log(`[trading-agent-execute] Found ${availableTokens.length} qualifying tokens (top: ${availableTokens[0].symbol} score=${availableTokens[0].token_score})`);
                break;
              }

              console.log(`[trading-agent-execute] ${scoredTokens.length} scored but none qualifying after filters`);
            }
          } catch (fetchError) {
            console.error(`[trading-agent-execute] Discovery error:`, fetchError);
            break;
          }

          // Wait before next poll
          if (Date.now() - discoveryStart + DISCOVERY_POLL_MS < DISCOVERY_MAX_MS) {
            await new Promise(r => setTimeout(r, DISCOVERY_POLL_MS));
          } else {
            break;
          }
        }

        if (availableTokens.length === 0) {
          console.log(`[trading-agent-execute] Agent ${agent.name}: no qualifying tokens after ${discoveryAttempt} attempts`);
          continue;
        }

        // Calculate available capital with tiered position sizing
        const availableCapital = (agent.trading_capital_sol || 0) - GAS_RESERVE_SOL;
        let positionSize = Math.min(
          availableCapital * (strategy.positionPct / 100),
          availableCapital / (strategy.maxPositions - openCount)
        );

        // Apply capital tier limits for risk management
        // Under 1 SOL: max 0.1 SOL per position
        // 1-2 SOL: max 0.25 SOL per position  
        // Above 2 SOL: use percentage-based sizing
        if (availableCapital < 1.0) {
          positionSize = Math.min(positionSize, 0.1);
        } else if (availableCapital < 2.0) {
          positionSize = Math.min(positionSize, 0.25);
        }

        // Lower minimum to 0.05 SOL for small capital agents
        if (positionSize < 0.05) {
          console.log(`[trading-agent-execute] Agent ${agent.name} position size too small: ${positionSize}`);
          continue;
        }

        // Use AI to analyze and select the best token
        const aiAnalysis = await analyzeTokensWithAI(
          LOVABLE_API_KEY,
          agent,
          availableTokens,
          pastTrades || [],
          recentReviews || [],
          strategy,
          positionSize
        );

        if (!aiAnalysis.shouldTrade) {
          console.log(`[trading-agent-execute] AI decided not to trade for ${agent.name}: ${aiAnalysis.reasoning}`);
          continue;
        }

        const selectedToken = availableTokens.find(t => t.mint_address === aiAnalysis.selectedToken);
        if (!selectedToken) continue;

        // Decrypt agent's wallet private key
        const agentKeypair = await decryptWallet(agent.wallet_private_key_encrypted, API_ENCRYPTION_KEY);
        if (!agentKeypair) {
          console.error(`[trading-agent-execute] Failed to decrypt wallet for ${agent.name}`);
          continue;
        }

        // Execute Jupiter swap: SOL -> Token
        const swapResult = await executeJupiterSwapWithJito(
          connection,
          agentKeypair,
          WSOL_MINT,
          selectedToken.mint_address,
          Math.floor(positionSize * 1e9), // Convert SOL to lamports
          SLIPPAGE_BPS
        );

        if (!swapResult.success) {
          console.error(`[trading-agent-execute] Swap failed for ${agent.name}:`, swapResult.error);
          continue;
        }

        const tokensReceived = swapResult.outputAmount || (positionSize / (selectedToken.price_sol || 0.000001));
        const actualPrice = positionSize / tokensReceived;

        // Calculate stop loss and take profit prices
        const stopLossPrice = actualPrice * (1 - strategy.stopLoss / 100);
        const takeProfitPrice = actualPrice * (1 + strategy.takeProfit / 100);

        // Create position record
        const { data: position, error: posError } = await supabase
          .from("trading_agent_positions")
          .insert({
            trading_agent_id: agent.id,
            token_address: selectedToken.mint_address,
            token_name: selectedToken.name,
            token_symbol: selectedToken.symbol,
            token_image_url: selectedToken.image_url?.startsWith('http') ? selectedToken.image_url : (selectedToken.image_url ? `https://ipfs.io/ipfs/${selectedToken.image_url}` : null),
            entry_price_sol: actualPrice,
            current_price_sol: actualPrice,
            amount_tokens: tokensReceived,
            investment_sol: positionSize,
            current_value_sol: positionSize,
            entry_reason: aiAnalysis.entryReason,
            entry_narrative: aiAnalysis.narrative,
            target_price_sol: takeProfitPrice,
            stop_loss_price_sol: stopLossPrice,
            risk_assessment: aiAnalysis.riskAssessment,
            market_conditions: aiAnalysis.marketConditions,
            status: "open",
          })
          .select()
          .single();

        if (posError) throw posError;

        // === Jupiter Limit Orders: Place on-chain TP only ===
        // NOTE: Stop-Loss CANNOT be a limit order — Jupiter limit orders are "sell at or above"
        // which means an SL order (sell at LOWER price) fills immediately since market price
        // already exceeds the SL threshold. SL is handled by DB-based polling in trading-agent-monitor.
        let tpOrderPubkey: string | null = null;
        const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");

        if (jupiterApiKey) {
          try {
            const tokenDecimals = await getTokenDecimals(connection, selectedToken.mint_address);
            
            // Determine raw token amount for limit orders
            let rawTokenAmount: number;
            if (tokensReceived > 1_000_000) {
              rawTokenAmount = Math.floor(tokensReceived);
            } else {
              rawTokenAmount = Math.floor(tokensReceived * Math.pow(10, tokenDecimals));
            }

            // Take Profit: sell all tokens at TP price → receive SOL
            const tpSolLamports = Math.floor(takeProfitPrice * tokensReceived * 1e9);
            const tpResult = await createJupiterLimitOrder(
              connection, agentKeypair, jupiterApiKey,
              selectedToken.mint_address, WSOL_MINT,
              rawTokenAmount.toString(), tpSolLamports.toString()
            );
            if (tpResult) {
              tpOrderPubkey = tpResult;
              console.log(`[trading-agent-execute] ✅ TP limit order placed: ${tpOrderPubkey}`);
            }
          } catch (limitOrderError) {
            console.warn(`[trading-agent-execute] Limit order placement failed, falling back to DB-based monitoring:`, limitOrderError);
          }
        }

        // Update position with limit order info
        // SL is always 'none' — monitored via DB-based price polling in trading-agent-monitor
        if (tpOrderPubkey) {
          await supabase
            .from("trading_agent_positions")
            .update({
              limit_order_sl_pubkey: null,
              limit_order_tp_pubkey: tpOrderPubkey,
              limit_order_sl_status: 'none',
              limit_order_tp_status: 'active',
            })
            .eq("id", position.id);
        }

        // Create trade record
        const { data: trade, error: tradeError } = await supabase
          .from("trading_agent_trades")
          .insert({
            trading_agent_id: agent.id,
            position_id: position.id,
            token_address: selectedToken.mint_address,
            token_name: selectedToken.name,
            trade_type: "buy",
            amount_sol: positionSize,
            amount_tokens: tokensReceived,
            price_per_token: actualPrice,
            strategy_used: agent.strategy_type,
            narrative_match: aiAnalysis.narrative,
            token_score: selectedToken.token_score,
            entry_analysis: aiAnalysis.fullAnalysis,
            ai_reasoning: aiAnalysis.reasoning,
            market_context: aiAnalysis.marketContext,
            confidence_score: aiAnalysis.confidence,
            status: "success",
            signature: swapResult.signature,
          })
          .select()
          .single();

        if (tradeError) throw tradeError;

        // Update agent stats
        await supabase
          .from("trading_agents")
          .update({
            trading_capital_sol: (agent.trading_capital_sol || 0) - positionSize,
            total_invested_sol: (agent.total_invested_sol || 0) + positionSize,
            total_trades: (agent.total_trades || 0) + 1,
            last_trade_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        // Post to SubTuna community
        if (swapResult.signature) {
          await postTradeToSubTuna(supabase, agent, trade, selectedToken, aiAnalysis, swapResult.signature);
        }

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          action: "buy",
          token: selectedToken.symbol,
          amount: positionSize,
          tokensReceived,
          signature: swapResult.signature,
          analysis: aiAnalysis.reasoning,
        });

        console.log(`[trading-agent-execute] ✅ ${agent.name} bought ${selectedToken.symbol} for ${positionSize.toFixed(4)} SOL (${swapResult.signature})`);

      } catch (agentError) {
        console.error(`[trading-agent-execute] Error processing agent ${agent.name}:`, agentError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tradesExecuted: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-execute] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function decryptWallet(encryptedKey: string, encryptionKey: string): Promise<Keypair | null> {
  try {
    // AES-256-GCM decryption
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
    console.error("[trading-agent-execute] Wallet decryption failed:", error);
    return null;
  }
}

async function executeJupiterSwapWithJito(
  connection: Connection,
  payer: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; outputAmount?: number; error?: string }> {
  try {
    // Get quote from Jupiter V1 API
    const quoteResult = await getJupiterQuote(inputMint, outputMint, amountLamports, slippageBps);
    
    if (!quoteResult) {
      return { success: false, error: "Jupiter quote failed" };
    }

    const { quote } = quoteResult;
    const outputAmount = parseInt(quote.outAmount) / 1e6; // Assuming 6 decimals for most tokens

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

    console.log(`[trading-agent-execute] Submitting to Jito: ${blockEngine}`);

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
        console.log('[trading-agent-execute] Jito bundle submitted:', jitoResult.result);
        
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
          console.log('[trading-agent-execute] ✅ Jito bundle confirmed:', signature);
          return { success: true, signature, outputAmount };
        }
      }
      
      console.warn('[trading-agent-execute] Jito bundle failed, falling back to standard send');
    } catch (jitoError) {
      console.warn('[trading-agent-execute] Jito error, falling back:', jitoError);
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
    console.error("[trading-agent-execute] Jupiter swap error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown swap error" };
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
    return 6;
  } catch {
    return 6;
  }
}

async function createJupiterLimitOrder(
  connection: Connection,
  payer: Keypair,
  jupiterApiKey: string,
  inputMint: string,
  outputMint: string,
  makingAmount: string,
  takingAmount: string
): Promise<string | null> {
  try {
    // Step 1: Create order via Jupiter Trigger API
    const createResponse = await fetchWithRetry(`${JUPITER_TRIGGER_URL}/createOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': jupiterApiKey,
      },
      body: JSON.stringify({
        inputMint,
        outputMint,
        maker: payer.publicKey.toBase58(),
        payer: payer.publicKey.toBase58(),
        params: {
          makingAmount,
          takingAmount,
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.warn(`[trading-agent-execute] Jupiter createOrder failed: ${createResponse.status} ${errorText}`);
      return null;
    }

    const orderData = await createResponse.json();
    const orderPubkey = orderData.order;
    const transactionBase64 = orderData.transaction;

    if (!orderPubkey || !transactionBase64) {
      console.warn('[trading-agent-execute] Jupiter createOrder response missing order/transaction');
      return null;
    }

    // Step 2: Sign the transaction
    const txBuf = Uint8Array.from(atob(transactionBase64), c => c.charCodeAt(0));
    const transaction = VersionedTransaction.deserialize(txBuf);

    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.message.recentBlockhash = blockhash;
    transaction.sign([payer]);

    // Step 3: Execute via Jupiter's execute endpoint
    const signedTxBase64 = btoa(String.fromCharCode(...transaction.serialize()));
    
    const executeResponse = await fetchWithRetry(`${JUPITER_TRIGGER_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': jupiterApiKey,
      },
      body: JSON.stringify({
        signedTransaction: signedTxBase64,
        requestId: orderData.requestId,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.warn(`[trading-agent-execute] Jupiter execute failed: ${executeResponse.status} ${errorText}`);
      
      // Fallback: send transaction directly
      try {
        const sig = await connection.sendTransaction(transaction, { skipPreflight: true, maxRetries: 3 });
        // Wait for confirmation
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const status = await connection.getSignatureStatus(sig);
          if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
            return orderPubkey;
          }
        }
      } catch (e) {
        console.warn('[trading-agent-execute] Direct send also failed:', e);
      }
      return null;
    }

    const executeResult = await executeResponse.json();
    if (executeResult.signature) {
      console.log(`[trading-agent-execute] Limit order confirmed: ${executeResult.signature}`);
      return orderPubkey;
    }

    return orderPubkey;
  } catch (error) {
    console.error('[trading-agent-execute] createJupiterLimitOrder error:', error);
    return null;
  }
}

async function analyzeTokensWithAI(
  apiKey: string,
  agent: any,
  tokens: any[],
  pastTrades: any[],
  recentReviews: any[],
  strategy: any,
  positionSize: number
): Promise<{
  shouldTrade: boolean;
  selectedToken: string | null;
  entryReason: string;
  reasoning: string;
  fullAnalysis: string;
  narrative: string;
  riskAssessment: string;
  marketConditions: string;
  marketContext: string;
  confidence: number;
}> {
  const tradeSummary = pastTrades.map(t => ({
    token: t.token_name,
    type: t.trade_type,
    pnl: t.realized_pnl_sol,
    won: (t.realized_pnl_sol || 0) > 0,
    lessons: t.lessons_learned,
  }));

  const winRate = agent.win_rate || 0;
  const consecutiveLosses = agent.consecutive_losses || 0;
  const avoidedPatterns = agent.avoided_patterns || [];
  const preferredNarratives = agent.preferred_narratives || [];

  const tokenList = tokens.slice(0, 10).map(t => ({
    address: t.mint_address,
    name: t.name,
    symbol: t.symbol,
    score: t.token_score,
    liquidity: t.liquidity_sol,
    holders: t.holder_count,
    narrative: t.narrative_category,
    age_hours: t.age_hours,
    volume_trend: t.volume_trend,
  }));

  const prompt = `You are ${agent.name}, an autonomous trading agent with a ${agent.strategy_type} strategy.

## Your Trading Profile
- Win Rate: ${winRate.toFixed(1)}%
- Consecutive Losses: ${consecutiveLosses}
- Strategy: ${agent.strategy_type} (SL: ${strategy.stopLoss}%, TP: ${strategy.takeProfit}%)
- Position Size: ${positionSize.toFixed(4)} SOL
- Preferred Narratives: ${preferredNarratives.join(", ") || "None yet"}
- Patterns to Avoid: ${avoidedPatterns.join(", ") || "None yet"}

## Recent Trade History
${tradeSummary.length > 0 ? JSON.stringify(tradeSummary, null, 2) : "No recent trades"}

## Strategy Reviews
${recentReviews.length > 0 ? recentReviews.map(r => r.key_insights).join("\n") : "No reviews yet"}

## Available Tokens
${JSON.stringify(tokenList, null, 2)}

## Instructions
Based on your trading history, learned patterns, and the available tokens:
1. Analyze each token's potential
2. Consider your past mistakes and successes
3. Factor in your current win rate and consecutive losses (if many losses, be more cautious)
4. Decide whether to trade or wait

Respond in this exact JSON format:
{
  "shouldTrade": true/false,
  "selectedToken": "mint_address or null",
  "entryReason": "2-3 sentence reason for entry",
  "reasoning": "Detailed reasoning (4-6 sentences) explaining your thought process",
  "fullAnalysis": "Complete market analysis paragraph (150-200 words) discussing why you chose this token, market conditions, expected risks, and your strategy",
  "narrative": "The narrative category (meme, AI, gaming, etc)",
  "riskAssessment": "Assessment of risks (2-3 sentences)",
  "marketConditions": "Current market conditions assessment",
  "marketContext": "Broader market context and timing",
  "confidence": 0-100
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
      console.error("[trading-agent-execute] AI API error:", response.status);
      return {
        shouldTrade: false,
        selectedToken: null,
        entryReason: "",
        reasoning: "AI analysis unavailable",
        fullAnalysis: "",
        narrative: "",
        riskAssessment: "",
        marketConditions: "",
        marketContext: "",
        confidence: 0,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[trading-agent-execute] Could not parse AI response");
      return {
        shouldTrade: false,
        selectedToken: null,
        entryReason: "",
        reasoning: "Could not parse AI response",
        fullAnalysis: "",
        narrative: "",
        riskAssessment: "",
        marketConditions: "",
        marketContext: "",
        confidence: 0,
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("[trading-agent-execute] AI analysis error:", error);
    return {
      shouldTrade: false,
      selectedToken: null,
      entryReason: "",
      reasoning: "AI analysis failed",
      fullAnalysis: "",
      narrative: "",
      riskAssessment: "",
      marketConditions: "",
      marketContext: "",
      confidence: 0,
    };
  }
}

async function postTradeToSubTuna(
  supabase: any,
  agent: any,
  trade: any,
  token: any,
  analysis: any,
  signature: string
) {
  try {
    // Find agent's SubTuna community
    const { data: subtuna } = await supabase
      .from("subtuna")
      .select("id")
      .eq("agent_id", agent.agent?.id)
      .single();

    if (!subtuna) {
      console.log("[trading-agent-execute] No SubTuna found for agent");
      return;
    }
    
    const title = `🔵 ENTERED $${token.symbol} @ ${trade.price_per_token?.toFixed(10)} SOL`;
    
    const content = `## Trade Analysis

**Entry Position: $${token.symbol}**

### 📊 Trade Details
- **Amount**: ${trade.amount_sol?.toFixed(4)} SOL
- **Tokens**: ${trade.amount_tokens?.toLocaleString()}
- **Price**: ${trade.price_per_token?.toFixed(10)} SOL
- **Token Score**: ${token.token_score}/100
- **Strategy**: ${agent.strategy_type}
- **Confidence**: ${analysis.confidence}%

### 🔗 Transaction
\`${signature}\`

### 🧠 My Analysis
${analysis.fullAnalysis}

### 🎯 Strategy
- **Entry Reason**: ${analysis.entryReason}
- **Target (TP)**: +${agent.strategy_type === "aggressive" ? "100" : agent.strategy_type === "balanced" ? "50" : "25"}%
- **Stop Loss**: -${agent.strategy_type === "aggressive" ? "30" : agent.strategy_type === "balanced" ? "20" : "10"}%

### ⚠️ Risk Assessment
${analysis.riskAssessment}

### 📈 Market Context
${analysis.marketContext}

---
*This is an autonomous trade executed by ${agent.name} via Jupiter DEX. Past performance does not guarantee future results.*`;

    const { data: post, error: postError } = await supabase
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

    if (postError) {
      console.error("[trading-agent-execute] Failed to create SubTuna post:", postError);
      return;
    }

    // Update trade with post reference
    await supabase
      .from("trading_agent_trades")
      .update({ subtuna_post_id: post.id })
      .eq("id", trade.id);

    console.log(`[trading-agent-execute] Posted trade analysis to SubTuna: ${post.id}`);
  } catch (error) {
    console.error("[trading-agent-execute] SubTuna post error:", error);
  }
}
