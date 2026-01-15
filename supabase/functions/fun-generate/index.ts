import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback themes if no narrative is active
const FALLBACK_THEMES = [
  "Kawaii anime mascot",
  "Cute chibi character",
  "Manga-style hero",
  "Japanese pop culture icon",
  "Cyber anime girl",
];

// Name generation fallbacks
const NAME_PREFIXES = ["Neko", "Kira", "Luna", "Miku", "Yuki", "Hana", "Sora", "Riku", "Momo", "Inu"];
const NAME_SUFFIXES = ["chan", "coin", "inu", "moon", "doge", "pepe", "cat", "punk", "ai"];

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Default socials for all generated tokens
const DEFAULT_WEBSITE = "https://ai67x.fun";
const DEFAULT_TWITTER = "https://x.com/ai67x_fun";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the active narrative from trending analysis
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

    console.log("[fun-generate] Parsed concept:", { name, ticker, description });

    // Fetch trending token images for style reference
    const { data: trendingTokens } = await supabase
      .from("trending_tokens")
      .select("name, symbol, image_url, description")
      .not("image_url", "is", null)
      .limit(10);
    
    // Build style context from trending tokens
    let styleContext = "";
    if (trendingTokens && trendingTokens.length > 0) {
      const tokenStyles = trendingTokens
        .filter(t => t.image_url)
        .map(t => `${t.name || t.symbol}: ${t.description || 'trending meme coin'}`)
        .slice(0, 5)
        .join("; ");
      styleContext = `Current trending coin styles: ${tokenStyles}. Match this professional meme coin aesthetic.`;
      console.log("[fun-generate] Using trending style context:", styleContext);
    }

    // Generate meme coin logo with authentic internet meme style
    const imagePrompt = `Draw a meme coin mascot for "${name}" ($${ticker}).

STYLE - CRITICAL:
- Raw internet meme energy like classic Pepe, Doge, Wojak
- Hand-drawn MS Paint or crude sketch aesthetic 
- Imperfect lines, rough edges, intentionally low-fi
- Single expressive character face or creature
- Solid flat colors, NO gradients, NO shine effects
- Transparent or simple solid color background

COMPOSITION:
- Just the mascot character, nothing else
- Big expressive eyes and simple features
- Funny or smug expression
- Close-up face or full body simple pose

VIBE:
- 4chan meme board culture
- Absurdist internet humor
- Deliberately crude but iconic
- The kind of image that becomes a viral meme

DO NOT:
- Make it look polished or professional
- Add any text, logos, or crypto symbols
- Use 3D effects, metallic textures, or glossy finishes
- Create clean vector art or corporate design
- Add lens flares, glow effects, or gradients
- Make it look like AI generated art

Think: original Pepe frog drawing, Doge shiba photo edits, Wojak simple sketches. Raw, iconic, memeable.`;

    console.log("[fun-generate] Generating professional image...");

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

    console.log("[fun-generate] Image generated successfully");

    // Return the generated meme concept with default socials
    return new Response(
      JSON.stringify({
        success: true,
        meme: {
          name,
          ticker,
          description,
          imageUrl,
          narrative: narrativeInfo,
          // Include default socials
          websiteUrl: DEFAULT_WEBSITE,
          twitterUrl: DEFAULT_TWITTER,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[fun-generate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
