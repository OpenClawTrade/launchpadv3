import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DexScreenerBoost {
  tokenAddress: string;
  chainId: string;
  icon?: string;
  name?: string;
  symbol?: string;
  description?: string;
  url?: string;
  totalAmount?: number;
  amount?: number;
}

interface DexScreenerPair {
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  info?: {
    imageUrl?: string;
    description?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch top 50 from DexScreener boosts
    console.log("Fetching top 50 tokens from DexScreener boosts...");
    const dexResponse = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
    
    if (!dexResponse.ok) {
      throw new Error(`DexScreener API error: ${dexResponse.status}`);
    }

    const boosts: DexScreenerBoost[] = await dexResponse.json();
    const top50 = boosts.slice(0, 50);
    
    console.log(`Fetched ${top50.length} boosted tokens from DexScreener`);

    // Fetch detailed token info for each token to get complete data
    // Group by chain and batch requests
    const tokensByChain = new Map<string, string[]>();
    for (const token of top50) {
      const chain = token.chainId || "solana";
      if (!tokensByChain.has(chain)) {
        tokensByChain.set(chain, []);
      }
      tokensByChain.get(chain)!.push(token.tokenAddress);
    }

    // Fetch detailed info from DexScreener tokens endpoint (supports multiple addresses)
    const tokenDetails = new Map<string, { name: string; symbol: string; imageUrl: string | null; description: string | null; url: string | null }>();
    
    for (const [chain, addresses] of tokensByChain) {
      // DexScreener allows up to 30 addresses per request
      const chunks = [];
      for (let i = 0; i < addresses.length; i += 30) {
        chunks.push(addresses.slice(i, i + 30));
      }
      
      for (const chunk of chunks) {
        try {
          const addressList = chunk.join(",");
          console.log(`Fetching details for ${chunk.length} tokens on ${chain}...`);
          
          const detailsResponse = await fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${addressList}`);
          
          if (detailsResponse.ok) {
            const pairs: DexScreenerPair[] = await detailsResponse.json();
            
            // Extract unique token info (may have multiple pairs per token)
            for (const pair of pairs) {
              if (pair.baseToken && !tokenDetails.has(pair.baseToken.address.toLowerCase())) {
                tokenDetails.set(pair.baseToken.address.toLowerCase(), {
                  name: pair.baseToken.name,
                  symbol: pair.baseToken.symbol,
                  imageUrl: pair.info?.imageUrl || null,
                  description: pair.info?.description || null,
                  url: pair.url || null,
                });
              }
            }
          } else {
            console.error(`Failed to fetch details for chunk: ${detailsResponse.status}`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Error fetching token details:`, err);
        }
      }
    }

    console.log(`Got detailed info for ${tokenDetails.size} tokens`);

    // Clear old trending tokens and insert new ones
    await supabase.from("trending_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const trendingTokens = top50.map((token, index) => {
      const details = tokenDetails.get(token.tokenAddress.toLowerCase());
      
      return {
        rank: index + 1,
        token_address: token.tokenAddress,
        chain_id: token.chainId || "solana",
        // Prefer detailed info, fallback to boost data
        name: details?.name || token.name || null,
        symbol: details?.symbol || token.symbol || null,
        description: details?.description || token.description || null,
        image_url: details?.imageUrl || token.icon || null,
        url: details?.url || token.url || `https://dexscreener.com/${token.chainId || 'solana'}/${token.tokenAddress}`,
        total_amount: token.totalAmount || null,
        amount: token.amount || null,
        synced_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase.from("trending_tokens").insert(trendingTokens);
    
    if (insertError) {
      console.error("Error inserting trending tokens:", insertError);
      throw insertError;
    }

    // Log what data we're missing for debugging
    const missingData = trendingTokens.filter(t => !t.name || !t.image_url);
    if (missingData.length > 0) {
      console.log(`Warning: ${missingData.length} tokens still missing name or image`);
    }

    console.log("Trending tokens synced successfully");

    // Analyze narratives using AI
    if (lovableApiKey) {
      console.log("Analyzing narratives with AI...");
      
      const tokenList = trendingTokens
        .filter(t => t.name)
        .map(t => `${t.name}${t.symbol ? ` (${t.symbol})` : ''}: ${t.description || 'No description'}`)
        .join('\n');
      
      if (!tokenList) {
        console.log("No token names available for narrative analysis");
        return new Response(
          JSON.stringify({ 
            success: true, 
            tokensCount: top50.length,
            message: "Trending tokens synced, but no names for narrative analysis" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a crypto trend analyst. Analyze the following list of trending tokens and identify the TOP 5 most prominent narratives/themes. 
For each narrative, provide:
1. A short narrative name (2-4 words)
2. A brief description (1 sentence)
3. How many tokens fit this narrative
4. 3 example token names that fit this narrative

Return ONLY valid JSON in this exact format:
{
  "narratives": [
    {
      "name": "Anime/Manga Memes",
      "description": "Tokens inspired by anime, manga, and Japanese culture",
      "count": 12,
      "examples": ["NEKOMANGA", "PsyopManga", "PSYOPMIA"]
    }
  ]
}`
            },
            {
              role: "user",
              content: `Here are the top 50 trending tokens on DexScreener right now:\n\n${tokenList}\n\nIdentify the top 5 narratives.`
            }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;
        
        if (content) {
          try {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              
              // Clear old narratives
              await supabase.from("trending_narratives").update({ is_active: false }).eq("is_active", true);
              await supabase.from("trending_narratives").delete().neq("id", "00000000-0000-0000-0000-000000000000");
              
              // Insert new narratives
              const narratives = parsed.narratives.map((n: any, idx: number) => ({
                narrative: n.name,
                description: n.description,
                token_count: n.count || 0,
                example_tokens: n.examples || [],
                popularity_score: (5 - idx) * 20, // Higher score for first narratives
                is_active: idx === 0, // First narrative is active by default
                analyzed_at: new Date().toISOString(),
              }));
              
              const { error: narrativeError } = await supabase.from("trending_narratives").insert(narratives);
              
              if (narrativeError) {
                console.error("Error inserting narratives:", narrativeError);
              } else {
                console.log(`Inserted ${narratives.length} narratives`);
              }
            }
          } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
          }
        }
      } else {
        console.error("AI API error:", await aiResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tokensCount: top50.length,
        detailedCount: tokenDetails.size,
        message: "Trending data synced successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in trending-sync:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
