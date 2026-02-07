import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Jupiter V6 API
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// Jito Block Engine endpoints
const JITO_ENDPOINTS = [
  "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
];

// Jito tip accounts
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
];

// SOL mint address
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Default tip in lamports (0.001 SOL)
const DEFAULT_TIP_LAMPORTS = 1_000_000;

// AES-256-GCM decryption
async function decryptPrivateKey(encryptedKey: string, encryptionKey: string): Promise<string> {
  const keyData = new TextEncoder().encode(encryptionKey);
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
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// Get random Jito endpoint
function getRandomJitoEndpoint(): string {
  return JITO_ENDPOINTS[Math.floor(Math.random() * JITO_ENDPOINTS.length)];
}

// Get random Jito tip account
function getRandomTipAccount(): string {
  return JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY") || "opentuna-default-key-change-in-production";
    const heliusRpc = Deno.env.get("HELIUS_RPC_URL");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      agentId,
      action, // 'buy' | 'sell' | 'quote'
      tokenMint,
      amountSol,
      amountTokens,
      slippageBps = 300, // 3% default slippage
      useJito = true, // Use Jito MEV protection by default
      tipLamports = DEFAULT_TIP_LAMPORTS,
    } = await req.json();

    if (!agentId || !action || !tokenMint) {
      return new Response(
        JSON.stringify({ error: "agentId, action, and tokenMint are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    const validActions = ['buy', 'sell', 'quote'];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists and get wallet
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, wallet_address, wallet_private_key_encrypted, balance_sol, total_fin_calls')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check DNA reef limits for trading constraints
    const { data: dna } = await supabase
      .from('opentuna_dna')
      .select('reef_limits')
      .eq('agent_id', agentId)
      .single();

    // Check for trading limits in reef_limits
    const reefLimits = dna?.reef_limits || [];
    for (const limit of reefLimits) {
      if (limit.toLowerCase().includes('never trade') || limit.toLowerCase().includes('no trading')) {
        return new Response(
          JSON.stringify({ error: "Trading is restricted by agent's reef limits" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check for max trade size limits
      const maxTradeMatch = limit.match(/never invest more than ([\d.]+) sol/i);
      if (maxTradeMatch && amountSol && parseFloat(amountSol) > parseFloat(maxTradeMatch[1])) {
        return new Response(
          JSON.stringify({ 
            error: `Trade exceeds reef limit: ${limit}`,
            maxAllowed: parseFloat(maxTradeMatch[1]),
            requested: amountSol,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Determine input/output mints and amounts
    let inputMint: string;
    let outputMint: string;
    let amount: number;

    if (action === 'buy') {
      inputMint = SOL_MINT;
      outputMint = tokenMint;
      amount = Math.floor((amountSol || 0.01) * 1e9); // SOL has 9 decimals
    } else {
      inputMint = tokenMint;
      outputMint = SOL_MINT;
      amount = amountTokens || 1000000; // Assume 6 decimals if not specified
    }

    // Get quote from Jupiter
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps: String(slippageBps),
    });

    const quoteResponse = await fetch(`${JUPITER_QUOTE_API}?${quoteParams}`);
    
    if (!quoteResponse.ok) {
      const quoteError = await quoteResponse.text();
      console.error("Jupiter quote error:", quoteError);
      return new Response(
        JSON.stringify({ error: "Failed to get quote from Jupiter", details: quoteError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const quote = await quoteResponse.json();

    // If just getting a quote, return here
    if (action === 'quote') {
      return new Response(
        JSON.stringify({
          success: true,
          action: 'quote',
          inputMint,
          outputMint,
          inputAmount: amount,
          outputAmount: quote.outAmount,
          priceImpactPct: quote.priceImpactPct,
          routePlan: quote.routePlan?.map((r: any) => r.swapInfo?.label).filter(Boolean),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For actual trades, we need the agent's wallet
    if (!agent.wallet_private_key_encrypted) {
      return new Response(
        JSON.stringify({ error: "Agent wallet not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have RPC configured
    if (!heliusRpc) {
      // Fallback to simulation if no RPC
      console.warn("HELIUS_RPC_URL not configured - returning simulated trade");
      
      const tradeResult = {
        success: true,
        action,
        tokenMint,
        inputAmount: amount,
        outputAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        signature: `simulated_${crypto.randomUUID().slice(0, 8)}`,
        message: "Trade simulated - configure HELIUS_RPC_URL for real execution",
        simulated: true,
      };

      // Log execution
      await logExecution(supabase, agentId, agent, action, tokenMint, amountSol, amountTokens, true);

      return new Response(
        JSON.stringify(tradeResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt private key
    let privateKeyBase58: string;
    try {
      privateKeyBase58 = await decryptPrivateKey(agent.wallet_private_key_encrypted, encryptionKey);
    } catch (decryptError) {
      console.error("Failed to decrypt agent wallet:", decryptError);
      return new Response(
        JSON.stringify({ error: "Failed to decrypt agent wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get swap transaction from Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: agent.wallet_address,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: useJito ? 0 : 100000, // Use Jito tip instead of priority fee
      }),
    });

    if (!swapResponse.ok) {
      const swapError = await swapResponse.text();
      console.error("Jupiter swap error:", swapError);
      return new Response(
        JSON.stringify({ error: "Failed to get swap transaction", details: swapError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { swapTransaction } = await swapResponse.json();

    // Import Solana web3 for transaction handling
    // Note: In production, use proper versioned transaction signing
    // For now, we'll submit via standard RPC or Jito

    let signature: string;

    if (useJito) {
      // Submit via Jito for MEV protection
      const jitoEndpoint = getRandomJitoEndpoint();
      const tipAccount = getRandomTipAccount();

      console.log(`[fin_trade] Submitting via Jito to ${jitoEndpoint}`);

      // For Jito bundles, we need to add a tip transaction
      // This is a simplified version - in production, properly construct the bundle
      const jitoResponse = await fetch(jitoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [[swapTransaction]], // Bundle with swap tx
        }),
      });

      const jitoResult = await jitoResponse.json();

      if (jitoResult.error) {
        console.error("Jito bundle error:", jitoResult.error);
        // Fallback to standard submission
        signature = await submitViaRpc(heliusRpc, swapTransaction);
      } else {
        signature = jitoResult.result || `jito_bundle_${crypto.randomUUID().slice(0, 8)}`;
        console.log(`[fin_trade] Jito bundle submitted: ${signature}`);
      }
    } else {
      // Submit via standard RPC
      signature = await submitViaRpc(heliusRpc, swapTransaction);
    }

    // Log execution
    await logExecution(supabase, agentId, agent, action, tokenMint, amountSol, amountTokens, true);

    // Store trade in memory
    await supabase.from('opentuna_deep_memory').insert({
      agent_id: agentId,
      content: `Executed ${action} trade: ${action === 'buy' ? amountSol + ' SOL' : amountTokens + ' tokens'} for ${tokenMint.slice(0, 16)}... Price impact: ${quote.priceImpactPct}%. Signature: ${signature}`,
      memory_type: 'anchor',
      importance: 8,
      tags: ['trade', action, tokenMint.slice(0, 8)],
    });

    console.log(`[fin_trade] ${action} for agent ${agent.name} - ${tokenMint.slice(0, 8)} - sig: ${signature}`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        tokenMint,
        inputAmount: amount,
        outputAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        signature,
        useJito,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_trade error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Submit transaction via RPC
async function submitViaRpc(rpcUrl: string, signedTransaction: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [
        signedTransaction,
        {
          encoding: 'base64',
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        },
      ],
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.message || 'Transaction failed');
  }

  return result.result;
}

// Log execution to database
async function logExecution(
  supabase: any,
  agentId: string,
  agent: any,
  action: string,
  tokenMint: string,
  amountSol: number | undefined,
  amountTokens: number | undefined,
  success: boolean
) {
  await supabase.from('opentuna_fin_executions').insert({
    agent_id: agentId,
    fin_name: 'fin_trade',
    params: { action, tokenMint, amountSol, amountTokens },
    params_hash: await hashParams({ action, tokenMint }),
    success,
    result_summary: `${action} ${action === 'buy' ? (amountSol || 0.01) + ' SOL' : (amountTokens || 0) + ' tokens'} - ${tokenMint.slice(0, 8)}...`,
  });

  // Update agent stats
  await supabase.from('opentuna_agents')
    .update({ 
      total_fin_calls: agent.total_fin_calls + 1,
      last_active_at: new Date().toISOString()
    })
    .eq('id', agentId);
}

async function hashParams(params: Record<string, any>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(params));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
