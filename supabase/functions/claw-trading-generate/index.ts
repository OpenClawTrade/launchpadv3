import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const strategyDetails = {
  conservative: {
    stopLoss: "10%", takeProfit: "25%", maxPositions: 2,
    style: "calm, analytical, wise expression with reading glasses aesthetic",
    description: "focuses on steady gains with minimal drawdown risk",
    personalities: ["Methodical lobster analyst", "Patient claw strategist", "Risk-averse shell guardian", "Steady accumulator", "Data-driven observer"],
  },
  balanced: {
    stopLoss: "20%", takeProfit: "50%", maxPositions: 3,
    style: "confident, focused, professional trader demeanor",
    description: "moderate risk-reward approach for consistent growth",
    personalities: ["Calculated claw opportunist", "Adaptive shell trader", "Balanced reef tactician", "Momentum rider", "Strategic executor"],
  },
  aggressive: {
    stopLoss: "30%", takeProfit: "100%", maxPositions: 5,
    style: "fierce, determined, bold with intense expression",
    description: "high-conviction plays targeting exponential returns",
    personalities: ["Alpha lobster hunter", "Fearless claw degen", "High-conviction maximalist", "Volatile momentum chaser", "Bold risk-taker"],
  },
};

async function callAIWithRetry(apiKey: string, body: object, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) return response;
      const errorText = await response.text();
      console.error(`AI attempt ${attempt + 1} failed:`, response.status, errorText);
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(`AI request failed with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
    }
  }
  throw lastError || new Error("AI request failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { strategy, personalityPrompt } = await req.json();
    if (!strategy || !strategyDetails[strategy as keyof typeof strategyDetails]) {
      return new Response(
        JSON.stringify({ error: "Valid strategy required (conservative, balanced, aggressive)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const details = strategyDetails[strategy as keyof typeof strategyDetails];

    const textPrompt = `Generate a professional trading agent identity for a ${strategy} strategy autonomous trading bot with LOBSTER/CLAW theme.

Requirements:
- Name: A lobster/claw-themed professional trading name (examples: "ClawQuant", "LobsterAlpha", "ReefSentinel", "ShellStrike", "PincerPro")
- Ticker: 3-5 uppercase characters derived from the name
- Personality: A 2-4 word personality trait with lobster/claw flavor
- Description: Under 300 chars, include ${details.stopLoss} SL, ${details.takeProfit} TP, ${details.maxPositions} max positions. Professional tone.

Return ONLY valid JSON: {"name": "...", "ticker": "...", "personality": "...", "description": "..."}`;

    let agentIdentity: { name: string; ticker: string; personality: string; description: string };

    try {
      const textResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: textPrompt }],
      });
      const textData = await textResponse.json();
      const textContent = textData.choices?.[0]?.message?.content || "";
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        agentIdentity = JSON.parse(jsonMatch[0]);
        if (!agentIdentity.personality) {
          agentIdentity.personality = details.personalities[Math.floor(Math.random() * details.personalities.length)];
        }
      } else throw new Error("No JSON found");
    } catch {
      const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      agentIdentity = {
        name: `ClawBot${randomSuffix}`,
        ticker: `CLAW${randomSuffix.charAt(0)}`,
        personality: details.personalities[Math.floor(Math.random() * details.personalities.length)],
        description: `Lobster-themed ${strategy} trading agent with ${details.stopLoss} stop-loss and ${details.takeProfit} take-profit. Up to ${details.maxPositions} concurrent positions. 🦞`,
      };
    }

    // Generate avatar
    const colorSchemes = [
      "deep red and crimson with fiery lobster tones",
      "dark red and orange with volcanic claw vibes",
      "scarlet and gold with royal lobster aesthetic",
      "crimson and teal with ocean depth contrast",
      "burgundy and amber with luxurious shell shine",
    ];
    const randomColor = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];

    const imagePrompt = `Create a fun, cute meme-style mascot for an AI trading agent called "${agentIdentity.name}".

Style:
- Cute, funny, expressive cartoon lobster/crustacean character
- ${randomColor} as the main color palette
- ${strategy.toUpperCase()} personality vibe: ${details.style}
- Meme energy — playful, colorful, NOT robotic or overly serious
- Can have subtle trading props (tiny chart, sunglasses, hat) but keep it fun and memey
- Single character, centered, simple/solid dark background
- No text, cute cartoon mascot style
- Think Doge-meme meets lobster character

Ultra high resolution, digital art style.`;

    let avatarUrl: string | null = null;
    try {
      const imageResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }, 1);
      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageBase64?.startsWith("data:image")) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const base64Data = imageBase64.split(",")[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `${agentIdentity.ticker.toLowerCase()}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from("trading-agents").upload(fileName, binaryData, { contentType: "image/png", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("trading-agents").getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }
    } catch (e) {
      console.error("Image generation error:", e);
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
    console.error("claw-trading-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
