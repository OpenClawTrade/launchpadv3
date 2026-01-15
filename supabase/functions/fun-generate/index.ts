import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback anime-style meme themes (used when no active narrative)
const FALLBACK_THEMES = [
  "chibi cat girl", "kawaii shiba inu", "neko samurai", "magical kitsune",
  "tsundere penguin", "super saiyan doge", "mecha hamster", "ninja frog",
  "sensei owl", "idol bunny", "yokai tanuki", "oni cat",
  "sakura dragon", "kaiju puppy", "shrine fox", "waifu coin",
];

// Short anime-inspired name prefixes and suffixes
const NAME_PREFIXES = [
  "Neko", "Shiba", "Inu", "Kawa", "Chibi", "Nyan", "Baka", "Suki",
  "Mochi", "Yuki", "Hana", "Kuro", "Aka", "Ao", "Midori", "Usagi",
  "Kitsune", "Tanuki", "Oni", "Yume", "Hoshi", "Tsuki", "Sora", "Umi",
];

const NAME_SUFFIXES = [
  "chan", "kun", "san", "sama", "coin", "inu", "neko", "doge",
  "moon", "star", "wave", "sun", "fire", "ice", "wind", "leaf",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Fetch active narrative from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let themeContext = "";
    let narrativeInfo = "";
    
    const { data: activeNarrative } = await supabase
      .from("trending_narratives")
      .select("*")
      .eq("is_active", true)
      .single();

    if (activeNarrative) {
      themeContext = `Current trending narrative: "${activeNarrative.narrative}" - ${activeNarrative.description}. 
Example tokens in this narrative: ${(activeNarrative.example_tokens || []).join(", ")}.
Create something that fits this trending theme but with a unique twist!`;
      narrativeInfo = activeNarrative.narrative;
      console.log("[fun-generate] Using active narrative:", activeNarrative.narrative);
    } else {
      // Fallback to random anime theme
      const randomTheme = FALLBACK_THEMES[Math.floor(Math.random() * FALLBACK_THEMES.length)];
      themeContext = `Theme: ${randomTheme}`;
      narrativeInfo = randomTheme;
      console.log("[fun-generate] No active narrative, using fallback theme:", randomTheme);
    }
    
    const conceptPrompt = `Create a TRENDING meme coin concept based on current market narratives.

${themeContext}

IMPORTANT REQUIREMENTS:
1. Name MUST be SHORT (1-2 words, max 12 characters)
2. Make it catchy, viral, and fits the current trending narrative
3. Ticker should be 3-4 letters
4. The concept should feel fresh and aligned with what's hot on crypto twitter

Return ONLY a JSON object with these exact fields (no markdown, no code blocks):
{
  "name": "Short catchy name (1-2 words, max 12 chars)",
  "ticker": "3-4 letter ticker in CAPS",
  "description": "Trendy description with emoji (max 80 chars)"
}`;

    console.log("[fun-generate] Generating concept for narrative:", narrativeInfo);

    const conceptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: conceptPrompt }
        ],
      }),
    });

    if (!conceptResponse.ok) {
      const errorText = await conceptResponse.text();
      console.error("[fun-generate] Concept generation failed:", errorText);
      throw new Error("Failed to generate meme concept");
    }

    const conceptData = await conceptResponse.json();
    const conceptText = conceptData.choices?.[0]?.message?.content || "";
    
    console.log("[fun-generate] Raw concept response:", conceptText);

    // Parse JSON from response
    let memeData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = conceptText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        memeData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[fun-generate] Parse error:", parseError);
      // Fallback: generate random anime-style name
      const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
      memeData = {
        name: `${prefix}${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`,
        ticker: prefix.slice(0, 4).toUpperCase(),
        description: "The cutest anime meme coin on Solana! ✨🌸",
      };
    }

    // Validate and sanitize - enforce short names
    let name = (memeData.name || "NekoInu").replace(/\s+/g, "").slice(0, 12);
    const ticker = (memeData.ticker || "NEKO").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const description = (memeData.description || "Kawaii meme coin! 🌸").slice(0, 100);

    // If name is still too long, use fallback
    if (name.length > 12) {
      const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
      name = `${prefix}${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`.slice(0, 12);
    }

    console.log("[fun-generate] Parsed anime concept:", { name, ticker, description });

    // Step 2: Generate circular logo image based on narrative
    const imagePrompt = `Create a VIRAL meme coin circular logo for "${name}" ($${ticker}).

STYLE REQUIREMENTS:
- Eye-catching and memeable design
- Vibrant colors that pop
- Clean bold outlines for clarity at small sizes
- Should look like a trending crypto token logo
- Make it feel fresh and aligned with the narrative

Narrative/Theme: ${narrativeInfo}
Description: ${description}

The image MUST be perfectly circular with simple gradient or transparent background.
Make it look like a viral crypto token logo that would trend on crypto twitter.`;

    console.log("[fun-generate] Generating image for narrative:", narrativeInfo);

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: imagePrompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("[fun-generate] Image generation failed:", errorText);
      throw new Error("Failed to generate meme image");
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("[fun-generate] No image URL in response");
      throw new Error("No image generated");
    }

    console.log("[fun-generate] Anime image generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        meme: {
          name,
          ticker,
          description,
          imageUrl,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fun-generate] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
