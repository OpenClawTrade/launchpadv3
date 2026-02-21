 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 const strategyDetails = {
   conservative: {
     stopLoss: "10%",
     takeProfit: "25%",
     maxPositions: 2,
     style: "calm, analytical, wise expression with reading glasses aesthetic",
     description: "focuses on steady gains with minimal drawdown risk",
    personalities: ["Methodical analyst", "Patient strategist", "Risk-averse guardian", "Steady accumulator", "Data-driven observer"],
   },
   balanced: {
     stopLoss: "20%",
     takeProfit: "50%",
     maxPositions: 3,
     style: "confident, focused, professional trader demeanor",
     description: "moderate risk-reward approach for consistent growth",
    personalities: ["Calculated opportunist", "Adaptive trader", "Balanced tactician", "Momentum rider", "Strategic executor"],
   },
   aggressive: {
     stopLoss: "30%",
     takeProfit: "100%",
     maxPositions: 5,
     style: "fierce, determined, bold with intense expression",
     description: "high-conviction plays targeting exponential returns",
    personalities: ["Alpha hunter", "Fearless degen", "High-conviction maximalist", "Volatile momentum chaser", "Bold risk-taker"],
   },
 };
 
// Helper to call AI with retry
async function callAIWithRetry(
  apiKey: string,
  body: object,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        return response;
      }
      
      // Log the error but continue retry for 5xx errors
      const errorText = await response.text();
      console.error(`AI request attempt ${attempt + 1} failed:`, response.status, errorText);
      
      if (response.status >= 500 && attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      
      throw new Error(`AI request failed with status ${response.status}: ${errorText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  
  throw lastError || new Error("AI request failed after retries");
}

 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const { strategy, personalityPrompt } = await req.json();
 
     if (!strategy || !strategyDetails[strategy as keyof typeof strategyDetails]) {
       return new Response(
         JSON.stringify({ error: "Valid strategy is required (conservative, balanced, aggressive)" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const details = strategyDetails[strategy as keyof typeof strategyDetails];
 
     // Step 1: Generate text (name, ticker, description)
     const textPrompt = `Generate a professional trading agent identity for a ${strategy} strategy autonomous trading bot.
 
 Requirements:
 - Name: A professional trading-themed name (examples: "AlphaQuant", "Sentinel", "VeloTrade", "ApexHunter", "Finwise", "TunaShark")
 - Ticker: 3-5 uppercase characters derived from the name
- Personality: A 2-4 word personality trait that matches the ${strategy} trading style (examples: "Methodical analyst", "Fearless momentum hunter", "Patient accumulator")
 - Description: A professional 2-3 sentence description that:
    1. MUST be under 300 characters (strict limit)
    2. Include key parameters: ${details.stopLoss} SL, ${details.takeProfit} TP, ${details.maxPositions} max positions
    3. Professional tone, no emojis
    4. Be concise but informative
 
Return ONLY valid JSON with no markdown: {"name": "...", "ticker": "...", "personality": "...", "description": "..."}`;
 
    let agentIdentity: { name: string; ticker: string; personality: string; description: string };
    
    try {
      const textResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: textPrompt }],
      });
      
      const textData = await textResponse.json();
      const textContent = textData.choices?.[0]?.message?.content || "";
      
      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        agentIdentity = JSON.parse(jsonMatch[0]);
        // Ensure personality exists
        if (!agentIdentity.personality) {
          const personalities = details.personalities;
          agentIdentity.personality = personalities[Math.floor(Math.random() * personalities.length)];
        }
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("AI generation failed, using fallback:", parseError);
      // Fallback to generated defaults with random suffix for uniqueness
      const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      const personalities = details.personalities;
      agentIdentity = {
        name: strategy === "aggressive" ? `ApexHunter${randomSuffix}` : strategy === "balanced" ? `VeloTrade${randomSuffix}` : `Sentinel${randomSuffix}`,
        ticker: strategy === "aggressive" ? `APEX${randomSuffix.charAt(0)}` : strategy === "balanced" ? `VELO${randomSuffix.charAt(0)}` : `STNL${randomSuffix.charAt(0)}`,
        personality: personalities[Math.floor(Math.random() * personalities.length)],
        description: `This agent employs a ${strategy} trading strategy with ${details.stopLoss} stop-loss and ${details.takeProfit} take-profit thresholds. Managing up to ${details.maxPositions} concurrent positions, it scans Solana markets for high-probability setups with favorable risk-reward profiles.`,
      };
    }

    // Step 2: Generate avatar image (optional - don't fail if this fails)
    // Pick a random vibrant color scheme for variety
    const colorSchemes = [
      "vibrant orange and gold with warm sunset tones",
      "electric purple and magenta with neon accents",
      "bright green and lime with fresh energy vibes",
      "hot pink and coral with bold tropical feel",
      "fiery red and orange with intense power aesthetic",
      "golden yellow and amber with luxurious shine",
      "emerald green and teal with nature-inspired depth",
      "violet and lavender with mystical undertones",
    ];
    const randomColor = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];

    const imagePrompt = `Create a professional trading AI agent mascot inspired by lobster/crab crustacean themes.

Style requirements:
- Professional trading aesthetic with subtle chart or data elements in background
- ${randomColor} as the PRIMARY color palette - make it vibrant and eye-catching
- Clean, modern design suitable for a financial trading platform
- ${strategy.toUpperCase()} personality: ${details.style}
- Single character, centered composition
- Solid dark background that complements the color scheme
- No text, no logos, cartoon mascot style with professional polish
- The character should look like an expert crypto trader mascot
- Lobster/crustacean inspired but anthropomorphized and professional

Ultra high resolution, digital art style.`;

    let avatarUrl: string | null = null;

    try {
      const imageResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }, 1); // Only 1 retry for image

      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (imageBase64 && imageBase64.startsWith("data:image")) {
        // Upload to Supabase storage
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Extract base64 data and convert to Uint8Array
        const base64Data = imageBase64.split(",")[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

        const fileName = `${agentIdentity.ticker.toLowerCase()}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("trading-agents")
          .upload(fileName, binaryData, {
            contentType: "image/png",
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("trading-agents")
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        } else {
          console.error("Upload error:", uploadError);
        }
      }
    } catch (imageError) {
      console.error("Image generation error (continuing without avatar):", imageError);
      // Continue without avatar - it's optional
    }

    return new Response(
      JSON.stringify({
        success: true,
        name: agentIdentity.name,
        ticker: agentIdentity.ticker.toUpperCase(),
        personality: agentIdentity.personality,
        description: agentIdentity.description,
        avatarUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("trading-agent-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
     });