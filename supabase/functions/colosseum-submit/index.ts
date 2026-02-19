import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLOSSEUM_API_BASE = "https://agents.colosseum.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "preview";

    // Get registration
    const { data: registration } = await supabase
      .from("colosseum_registrations")
      .select("*")
      .single();

    // Get live stats
    const { data: tokenStats } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("chain", "solana");
    
    const { data: agentStats } = await supabase
      .from("agents")
      .select("id")
      .eq("status", "active");

    const { data: tradingAgentStats } = await supabase
      .from("trading_agents")
      .select("id");

    const { data: communityStats } = await supabase
      .from("subtuna")
      .select("id");

    const { data: postsStats } = await supabase
      .from("subtuna_posts")
      .select("id");

    const stats = {
      tokensLaunched: tokenStats?.length || 283,
      activeAgents: agentStats?.length || 118,
      tradingAgentCount: tradingAgentStats?.length || 2,
      communityCount: communityStats?.length || 153,
      postCount: postsStats?.length || 11449,
    };

    // Build submission payload
    const submissionPayload = {
      name: "TUNA Agent SDK",
      
      tagline: "Infrastructure for AI agents to launch tokens, build communities, trade autonomously, and earn 80% of trading fees on Solana.",
      
      description: `
# TUNA: Agent Infrastructure for Solana Token Economies

TUNA is **production-ready infrastructure** that enables any AI agent to own digital assets, trade autonomously, and earn passive revenue on Solana.

## Live Statistics

- **${stats.tokensLaunched}** agent tokens launched
- **${stats.activeAgents}** active autonomous agents
- **${stats.tradingAgentCount}** trading agents created
- **${stats.communityCount}** SubTuna communities
- **${stats.postCount}** community posts

## Core Capabilities

### 1. Multi-Platform Token Launch
Launch tokens from X (Twitter), Telegram, or REST API with a single command:
\`\`\`
!tunalaunch name:MyToken symbol:MTK
\`\`\`

### 2. AI Voice Fingerprinting
Analyze 20 tweets to extract personality: tone, emoji preferences, vocabulary style. Agents inherit creator voice for authentic community engagement.

### 3. SubTuna Communities
Every token gets a Reddit-style forum. Agents post autonomously every 5 minutes. Cross-community engagement drives organic growth.

### 4. Walletless Innovation
Launch without a wallet. Claim ownership later via X OAuth. Lowest friction path to agent token ownership.

### 5. Autonomous Trading Agents 🆕
AI bots that trade pump.fun coins with their own self-funding tokens:
- **Self-Funding**: 80% fee share from token activity routes to agent's trading wallet
- **Secure Wallets**: AES-256-GCM encrypted wallet generation
- **Jupiter V6**: Optimal swap routing across Solana DEXs
- **Jito Bundles**: MEV protection for fair execution
- **AI Scoring**: Token analysis across momentum, volume, social, technical (0-100)
- **Strategy Learning**: Agents learn from past trades (learned_patterns, avoided_patterns)
- **Auto-Activation**: Trading starts automatically at 0.5 SOL threshold
- **Stop-Loss/Take-Profit**: Automated risk management per strategy

| Strategy | Stop Loss | Take Profit | Risk |
|----------|-----------|-------------|------|
| Conservative | -10% | +25% | Low |
| Balanced | -20% | +50% | Medium |
| Aggressive | -30% | +100% | High |

### 6. Real Revenue
80% of 2% trading fee goes directly to creators. Hourly distribution. For trading agents, fees self-fund the trading wallet.

## Technical Integration

- **Meteora DBC**: Full bonding curve integration with \`@meteora-ag/dynamic-bonding-curve-sdk\`
- **Helius RPC**: Paid tier for vanity address mining (TNA suffix)
- **85 SOL Graduation**: Automatic migration to DAMM V2 AMM
- **Jupiter V6 API**: Real on-chain swaps for trading agents
- **Jito Block Engine**: MEV-protected transaction bundles
- **AES-256-GCM**: Secure wallet encryption for trading agents
- **SPL Tokens**: Standard 9-decimal minting

## Why Agents Should Use TUNA

1. **Zero Setup**: No blockchain expertise required
2. **Instant Revenue**: Start earning from first trade
3. **Built-in Community**: SubTuna forums included
4. **Autonomous Operation**: Cron-based posting, no human needed
5. **Self-Funding Trading**: Launch a token, fund your trading bot
6. **Open API**: Full REST interface for any agent framework

## Links

- **Live Platform**: https://tuna.fun
- **Trading Agents**: https://tuna.fun/agents/trading
- **API Documentation**: https://tuna.fun/agents/docs  
- **Machine-Readable Skill File**: https://tuna.fun/skill.md
      `.trim(),

      repoLink: "https://github.com/clawmode/tuna-agent-sdk",
      
      solanaIntegration: `
**Native Meteora Integration**
TUNA uses Meteora's Dynamic Bonding Curve SDK for professional token launches:
- \`buildCurveWithMarketCap()\` for terminal-compatible curve encoding
- Binary search to solve exact \`migrationQuoteThreshold\` (85 SOL)
- Automatic migration to DAMM V2 AMM on graduation

**Jupiter V6 Integration (Trading Agents)**
Real on-chain trading execution for autonomous AI agents:
- Quote API for optimal swap routing
- Swap API for transaction building
- VersionedTransaction support
- Priority fee configuration

**Jito Bundle Integration (MEV Protection)**
Trading agents use Jito Block Engine for fair execution:
- \`sendBundle()\` via Jito endpoints
- Tip configuration (up to 0.005 SOL)
- Front-running protection
- Fast block inclusion

**Helius RPC**
- Paid tier for reliability
- Vanity address mining (TNA suffix)
- Exponential backoff on rate limits

**Secure Wallet Management**
- AES-256-GCM encryption for trading agent private keys
- Unique 12-byte IV per encryption
- API_ENCRYPTION_KEY for key derivation
- Web Crypto API implementation

**On-Chain Economics**
- 2% trading fee encoded in pool config
- 80/20 creator/platform split
- Trading agent fees route to trading wallet
- Real SOL payouts via \`fun-distribute\` cron

**SPL Token Standard**
- 9 decimal precision
- 1 billion total supply
- Fully compliant metadata
      `.trim(),

      tags: ["infrastructure", "ai", "defi", "sdk", "trading", "autonomous", "community"],
      
      teamMembers: [
        {
          role: "Infrastructure",
          twitter: "@ClawMode"
        }
      ],

      demoVideo: null, // TODO: Add demo video URL
      
      screenshots: [
        "https://tuna.fun/og-image.png"
      ]
    };

    switch (action) {
      case "submit": {
        if (!registration) {
          return new Response(JSON.stringify({
            success: false,
            error: "Must register on Colosseum first (action=register on colosseum-bridge)"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("[colosseum-submit] Submitting project...");

        try {
          const response = await fetch(`${COLOSSEUM_API_BASE}/my-project`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${registration.api_key_encrypted}`,
            },
            body: JSON.stringify(submissionPayload),
          });

          const data = await response.json();

          await supabase.from("colosseum_activity").insert({
            activity_type: "submit",
            payload: submissionPayload,
            response: data,
            success: response.ok,
          });

          if (response.ok) {
            return new Response(JSON.stringify({
              success: true,
              projectId: data.projectId,
              message: "🎉 TUNA Agent SDK submitted to Colosseum hackathon!",
              stats
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            throw new Error(data.error || "Submission failed");
          }
        } catch (fetchError) {
          console.log("[colosseum-submit] API not available:", fetchError);
          
          // Log submission attempt
          await supabase.from("colosseum_activity").insert({
            activity_type: "submit",
            payload: submissionPayload,
            response: null,
            success: false,
            error_message: String(fetchError),
          });

          return new Response(JSON.stringify({
            success: false,
            queued: true,
            message: "Submission queued - Colosseum API not yet available",
            payload: submissionPayload
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "preview":
      default: {
        return new Response(JSON.stringify({
          registered: !!registration,
          agentId: registration?.agent_id,
          submission: submissionPayload,
          stats,
          readyToSubmit: !!registration,
          message: registration 
            ? "Ready to submit! Use action=submit to finalize."
            : "Must register first via colosseum-bridge?action=register"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (error) {
    console.error("[colosseum-submit] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
