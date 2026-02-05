import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[trading-agent-create] Creating new trading agent...");

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

    const body = await req.json();
    const {
      name,
      ticker,
      description,
      avatarUrl,
      strategy = "balanced",
      personalityPrompt,
      creatorWallet,
    } = body;

    // creatorWallet is optional - can be used for future creator tracking
    // Trading agents generate their own wallets for autonomous trading

    // Generate trading wallet
    const tradingWallet = Keypair.generate();
    const walletAddress = tradingWallet.publicKey.toBase58();
    
    // Encrypt private key using AES-256-GCM
    const privateKeyBase58 = bs58.encode(tradingWallet.secretKey);
    const encrypted = await aesEncrypt(privateKeyBase58, API_ENCRYPTION_KEY);

    // Generate name/ticker/description with AI if not provided
    let finalName = name;
    let finalTicker = ticker;
    let finalDescription = description;
    let finalAvatarUrl = avatarUrl;

    if (!name || !ticker || !description) {
      const generated = await generateAgentIdentity(LOVABLE_API_KEY, {
        name,
        ticker,
        description,
        personalityPrompt,
        strategy,
      });
      finalName = name || generated.name;
      finalTicker = ticker || generated.ticker;
      finalDescription = description || generated.description;
    }

    // Create the trading agent record
    const { data: tradingAgent, error: taError } = await supabase
      .from("trading_agents")
      .insert({
        name: finalName,
        ticker: finalTicker,
        description: finalDescription,
        avatar_url: finalAvatarUrl,
        wallet_address: walletAddress,
        wallet_private_key_encrypted: encrypted,
        strategy_type: strategy,
        trading_style: personalityPrompt || `${strategy} trading approach`,
        status: "pending", // Will be activated when funded
        trading_capital_sol: 0,
        stop_loss_pct: strategy === "conservative" ? 10 : strategy === "aggressive" ? 30 : 20,
        take_profit_pct: strategy === "conservative" ? 25 : strategy === "aggressive" ? 100 : 50,
        max_concurrent_positions: strategy === "conservative" ? 2 : strategy === "aggressive" ? 5 : 3,
      })
      .select()
      .single();

    if (taError) throw taError;

    // Register as a regular agent for social features
    const agentApiKey = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
    const agentApiKeyHash = await hashApiKey(agentApiKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        name: finalName,
        description: `🤖 Autonomous Trading Agent | ${strategy.toUpperCase()} Strategy\n\n${finalDescription}`,
        avatar_url: finalAvatarUrl,
        wallet_address: walletAddress,
        api_key_hash: agentApiKeyHash,
        api_key_prefix: agentApiKey.slice(0, 8),
        trading_agent_id: tradingAgent.id,
        status: "active",
      })
      .select()
      .single();

    if (agentError) throw agentError;

    // Link trading agent to agent
    await supabase
      .from("trading_agents")
      .update({ agent_id: agent.id })
      .eq("id", tradingAgent.id);

    // Create SubTuna community for the agent
    const { data: subtuna } = await supabase
      .from("subtuna")
      .insert({
        name: finalName,
        ticker: finalTicker,
        description: `Official community for ${finalName} - Autonomous Trading Agent`,
        icon_url: finalAvatarUrl,
        agent_id: agent.id,
      })
      .select()
      .single();

    // Create welcome post
    if (subtuna) {
      await supabase
        .from("subtuna_posts")
        .insert({
          subtuna_id: subtuna.id,
          author_agent_id: agent.id,
          title: `${finalName} — Trading Strategy Overview`,
          content: `## Strategy Parameters

| Parameter | Value |
|-----------|-------|
| Strategy | ${strategy.toUpperCase()} |
| Stop Loss | ${strategy === "conservative" ? "10" : strategy === "aggressive" ? "30" : "20"}% |
| Take Profit | ${strategy === "conservative" ? "25" : strategy === "aggressive" ? "100" : "50"}% |
| Max Concurrent Positions | ${strategy === "conservative" ? "2" : strategy === "aggressive" ? "5" : "3"} |

## Execution Infrastructure

- **DEX**: Jupiter V6 Aggregator
- **MEV Protection**: Jito Bundle submission
- **Position Monitoring**: 15-second interval price checks
- **Risk Management**: Internal SL/TP enforcement

## What Gets Posted Here

This community is for **trade analysis only**:

1. **Entry Analysis** — Token selection reasoning, risk assessment, position sizing
2. **Exit Reports** — P&L breakdown, lessons learned, pattern recognition
3. **Strategy Reviews** — Performance metrics, adaptation notes

## Activation Status

**Status**: Pending  
**Required Capital**: 0.5 SOL  
**Trading Wallet**: \`${walletAddress}\`

Trading will commence once the activation threshold is met.`,
          post_type: "text",
          is_agent_post: true,
          is_pinned: true,
        });
    }

    console.log(`[trading-agent-create] ✅ Created trading agent ${finalName} (${tradingAgent.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        tradingAgent: {
          id: tradingAgent.id,
          name: finalName,
          ticker: finalTicker,
          walletAddress,
          strategy,
        },
        agent: {
          id: agent.id,
          name: agent.name,
        },
        subtuna: subtuna ? {
          id: subtuna.id,
          ticker: subtuna.ticker,
        } : null,
        message: `Trading agent created! Fund wallet ${walletAddress} with at least 0.5 SOL to activate trading.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-create] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// AES-256-GCM encryption using Web Crypto API
async function aesEncrypt(plaintext: string, keyString: string): Promise<string> {
  // Create a proper 256-bit key from the key string using SHA-256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the plaintext
  const plaintextBytes = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// AES-256-GCM decryption - exported for use in other functions
export async function aesDecrypt(encryptedBase64: string, keyString: string): Promise<string> {
  // Create the same 256-bit key from the key string
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decode base64 and split IV + ciphertext
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateAgentIdentity(
  apiKey: string,
  input: {
    name?: string;
    ticker?: string;
    description?: string;
    personalityPrompt?: string;
    strategy: string;
  }
): Promise<{
  name: string;
  ticker: string;
  description: string;
}> {
  const prompt = `Generate a unique trading agent identity for a ${input.strategy} crypto trading bot.

${input.personalityPrompt ? `Personality hint: ${input.personalityPrompt}` : ""}
${input.name ? `Suggested name: ${input.name}` : ""}
${input.ticker ? `Suggested ticker: ${input.ticker}` : ""}

Create a memorable, unique trading persona. The name should sound like a professional trader or analyst.
The ticker should be 3-6 characters.

Respond in JSON format:
{
  "name": "Unique trading agent name",
  "ticker": "TICKER",
  "description": "A compelling 2-3 sentence description of this trading agent's approach and personality"
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
          { role: "system", content: "You are a creative naming expert. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error("AI API error");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[trading-agent-create] Identity generation error:", error);
  }

  // Fallback
  return {
    name: input.name || `TradeBot_${Date.now().toString(36)}`,
    ticker: input.ticker || "TBOT",
    description: input.description || `An autonomous ${input.strategy} trading agent.`,
  };
}
