import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DexScreenerToken {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch top 50 from DexScreener
    console.log("Fetching top 50 tokens from DexScreener...");
    const dexResponse = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
    
    if (!dexResponse.ok) {
      throw new Error(`DexScreener API error: ${dexResponse.status}`);
    }

    const tokens: DexScreenerToken[] = await dexResponse.json();
    const top50 = tokens.slice(0, 50);
    
    console.log(`Fetched ${top50.length} tokens from DexScreener`);

    // Clear old trending tokens and insert new ones
    await supabase.from("trending_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const trendingTokens = top50.map((token, index) => ({
      rank: index + 1,
      token_address: token.tokenAddress,
      chain_id: token.chainId || "solana",
      name: token.name || null,
      symbol: token.symbol || null,
      description: token.description || null,
      image_url: token.icon || null,
      url: token.url || null,
      total_amount: token.totalAmount || null,
      amount: token.amount || null,
      synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase.from("trending_tokens").insert(trendingTokens);
    
    if (insertError) {
      console.error("Error inserting trending tokens:", insertError);
      throw insertError;
    }

    console.log("Trending tokens synced successfully");

    // Analyze narratives using AI
    if (lovableApiKey) {
      console.log("Analyzing narratives with AI...");
      
      const tokenList = top50.map(t => `${t.name || t.symbol || 'Unknown'}: ${t.description || 'No description'}`).join('\n');
      
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
