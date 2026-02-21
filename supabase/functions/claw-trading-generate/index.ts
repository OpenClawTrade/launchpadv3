import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const userIdea = (personalityPrompt || "").trim();

    if (!userIdea) {
      return new Response(
        JSON.stringify({ error: "A description/idea is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to extract explicit name and ticker from the user's request BEFORE calling AI
    // Patterns like: "name X and ticker $Y", "name X ticker Y", "called X $Y", etc.
    const nameMatch = userIdea.match(/(?:name|called|named)\s+([A-Za-z0-9.\s]+?)(?:\s+(?:and\s+)?(?:the\s+)?ticker\s+(?:is\s+)?\$?([A-Z0-9.]{2,10}))/i)
      || userIdea.match(/(?:name|called|named)\s+([A-Za-z0-9.]+)\s+\$([A-Z0-9.]{2,10})/i)
      || userIdea.match(/\$([A-Z0-9.]{2,10})\s+(?:name|called|named)\s+([A-Za-z0-9.\s]+)/i);
    
    // Also try: "token X ticker Y" or just explicit "$TICKER - Name" patterns
    const tickerOnlyMatch = !nameMatch ? userIdea.match(/ticker\s+(?:is\s+)?\$?([A-Z0-9.]{2,10})/i) : null;
    const nameOnlyMatch = !nameMatch ? userIdea.match(/(?:token\s+)?name\s+(?:is\s+)?([A-Za-z0-9.]+)/i) : null;

    let explicitName: string | null = null;
    let explicitTicker: string | null = null;

    if (nameMatch) {
      // Check which capture group pattern matched
      if (userIdea.match(/\$([A-Z0-9.]{2,10})\s+(?:name|called)/i)) {
        explicitTicker = nameMatch[1].trim().toUpperCase();
        explicitName = nameMatch[2].trim();
      } else {
        explicitName = nameMatch[1].trim();
        explicitTicker = nameMatch[2].trim().toUpperCase();
      }
    } else {
      if (tickerOnlyMatch) explicitTicker = tickerOnlyMatch[1].trim().toUpperCase();
      if (nameOnlyMatch) explicitName = nameOnlyMatch[1].trim();
    }

    // Generate meme token identity purely from user's idea
    const textPrompt = `You are a meme coin name generator. The user wants to launch a meme coin based on this idea: "${userIdea}"

${explicitName ? `CRITICAL: The user EXPLICITLY requested the token name to be "${explicitName}". You MUST use EXACTLY "${explicitName}" as the name. Do NOT change it, do NOT get creative with the name.` : ''}
${explicitTicker ? `CRITICAL: The user EXPLICITLY requested the ticker to be "${explicitTicker}". You MUST use EXACTLY "${explicitTicker}" as the ticker. Do NOT change it, do NOT get creative with the ticker.` : ''}

Generate a meme token identity. Rules:
${explicitName ? `- Name: USE EXACTLY "${explicitName}" - do NOT modify it` : '- Name: 1-2 short catchy meme-style words (max 10 chars total). Must directly relate to the user\'s idea.'}
${explicitTicker ? `- Ticker: USE EXACTLY "${explicitTicker}" - do NOT modify it` : '- Ticker: 3-6 UPPERCASE letters that make sense from the name. NO random letter combos.'}
- Description: Fun catchy meme coin description under 200 chars with emoji. Reference the user's idea.
- Personality: 2-4 word fun personality matching the character vibe

IMPORTANT: Do NOT use lobster/claw/pincer themes unless the user specifically asked for them. Match the user's idea exactly.

Return ONLY valid JSON: {"name": "...", "ticker": "...", "personality": "...", "description": "..."}`;

    let identity: { name: string; ticker: string; personality: string; description: string };

    try {
      const textResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: textPrompt }],
      });
      const textData = await textResponse.json();
      const textContent = textData.choices?.[0]?.message?.content || "";
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        identity = JSON.parse(jsonMatch[0]);
        if (!identity.name || !identity.ticker) throw new Error("Missing name or ticker");
      } else throw new Error("No JSON found");
    } catch {
      // Fallback: derive from user prompt
      const words = userIdea.split(/\s+/).filter(Boolean);
      const name = explicitName || words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 10);
      const ticker = explicitTicker || name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5) || "MEME";
      identity = {
        name: name || "MemeCoin",
        ticker,
        personality: "Degen meme lord",
        description: `${name} - born from the idea: "${userIdea}" 🚀`,
      };
    }

    // ALWAYS override with explicit values if user specified them - AI must not ignore user's exact request
    if (explicitName) identity.name = explicitName;
    if (explicitTicker) identity.ticker = explicitTicker;

    // Generate avatar based on user's idea
    const imagePrompt = `Create a fun, cute meme-style illustration for a memecoin called "${identity.name}" based on this idea: "${userIdea}"

Style:
- The MAIN subject must match what the user described (if they said cat, draw a cat; if dog, draw a dog; etc.)
- Add subtle lobster/claw accessories as a brand touch (tiny claw gloves, small antennae, a lobster buddy in the corner)
- Cute, funny, expressive, colorful meme art style (think Doge-meme energy)
- Single character, centered, solid dark background
- No text, cartoon mascot style
- Ultra high resolution, digital art`;

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
        const fileName = `${identity.ticker.toLowerCase()}-${Date.now()}.png`;
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
        name: identity.name,
        ticker: identity.ticker.toUpperCase(),
        personality: identity.personality,
        description: identity.description,
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
