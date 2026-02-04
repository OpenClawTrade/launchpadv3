import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Narrative categories for scoring
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[pumpfun-trending-sync] Syncing trending tokens from pump.fun...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch trending tokens from pump.fun
    const response = await fetch("https://frontend-api.pump.fun/coins?sort=bump_order&limit=100&includeNsfw=false", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TunaBot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`pump.fun API error: ${response.status}`);
    }

    const tokens = await response.json();
    console.log(`[pumpfun-trending-sync] Fetched ${tokens.length} tokens from pump.fun`);

    const scored: any[] = [];
    const now = Date.now();

    for (const token of tokens) {
      try {
        // Calculate token age in hours
        const createdAt = new Date(token.created_timestamp || Date.now()).getTime();
        const ageHours = (now - createdAt) / (1000 * 60 * 60);

        // Get liquidity (virtual_sol_reserves approximation)
        const liquiditySol = (token.virtual_sol_reserves || 0) / 1e9;
        
        // Get holder count
        const holderCount = token.holder_count || 0;

        // Calculate base score (0-100)
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
        else if (ageHours < 1) score += 3; // Too new, risky

        // King of the Hill bonus (10 points)
        if (token.king_of_the_hill_timestamp) {
          score += 10;
        }

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

        // Volume trend (approximated from reply_count as proxy for activity)
        const replyCount = token.reply_count || 0;
        if (replyCount >= 50) score += 20;
        else if (replyCount >= 25) score += 15;
        else if (replyCount >= 10) score += 10;
        else if (replyCount >= 5) score += 5;

        // Apply narrative weight
        score = Math.min(100, Math.round(score * narrativeWeight));

        // Calculate price
        const priceSol = token.virtual_sol_reserves && token.virtual_token_reserves
          ? (token.virtual_sol_reserves / 1e9) / (token.virtual_token_reserves / 1e6)
          : 0;

        scored.push({
          mint_address: token.mint,
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          image_url: token.image_uri,
          price_sol: priceSol,
          liquidity_sol: liquiditySol,
          holder_count: holderCount,
          age_hours: ageHours,
          score,
          narrative_category: narrativeCategory,
          volume_trend: replyCount >= 25 ? "rising" : replyCount >= 10 ? "stable" : "low",
          is_king_of_hill: !!token.king_of_the_hill_timestamp,
          reply_count: replyCount,
          last_updated: new Date().toISOString(),
        });
      } catch (tokenError) {
        console.error(`[pumpfun-trending-sync] Error processing token:`, tokenError);
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Upsert into database (top 100)
    const topTokens = scored.slice(0, 100);

    for (const token of topTokens) {
      await supabase
        .from("pumpfun_trending_tokens")
        .upsert(token, { onConflict: "mint_address" });
    }

    // Clean up old tokens (older than 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("pumpfun_trending_tokens")
      .delete()
      .lt("last_updated", yesterday);

    console.log(`[pumpfun-trending-sync] ✅ Synced ${topTokens.length} tokens, top score: ${topTokens[0]?.score}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: topTokens.length,
        topTokens: topTokens.slice(0, 5).map(t => ({
          symbol: t.symbol,
          score: t.score,
          narrative: t.narrative_category,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[pumpfun-trending-sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
