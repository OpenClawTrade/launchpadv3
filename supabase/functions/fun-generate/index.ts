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

// Image generation models to try in order
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

// Helper function to generate image with retry logic
async function generateImageWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Cycle through models on each attempt
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    console.log(`[fun-generate] Image attempt ${attempt + 1}/${maxRetries} using ${model}`);
    
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fun-generate] Model ${model} HTTP error:`, response.status, errorText);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`[fun-generate] Model ${model} response structure:`, JSON.stringify({
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        hasImages: !!data.choices?.[0]?.message?.images,
        imagesLength: data.choices?.[0]?.message?.images?.length,
      }));
      
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (imageUrl) {
        console.log(`[fun-generate] Successfully generated image with ${model}`);
        return imageUrl;
      }
      
      console.warn(`[fun-generate] Model ${model} returned no image URL, retrying...`);
      lastError = new Error("No image URL in response");
      
    } catch (err) {
      console.error(`[fun-generate] Model ${model} exception:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    
    // Small delay between retries
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw lastError || new Error("Failed to generate image after all retries");
}

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

    // Fetch existing token names to avoid duplicates
    const { data: existingTokens } = await supabase
      .from("fun_tokens")
      .select("name")
      .order("created_at", { ascending: false })
      .limit(100);
    
    const { data: existingMainTokens } = await supabase
      .from("tokens")
      .select("name")
      .order("created_at", { ascending: false })
      .limit(100);

    const existingNames = new Set([
      ...(existingTokens || []).map(t => t.name?.toLowerCase()),
      ...(existingMainTokens || []).map(t => t.name?.toLowerCase()),
    ].filter(Boolean));

    const forbiddenNames = Array.from(existingNames).slice(0, 50).join(", ");
    console.log("[fun-generate] Forbidden names (already exist):", forbiddenNames);

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
Create something INSPIRED BY this trending theme but with a COMPLETELY UNIQUE name!`;
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

CRITICAL - FORBIDDEN NAMES (NEVER USE THESE, THEY ALREADY EXIST):
${forbiddenNames || "None yet"}

CRITICAL NAME REQUIREMENTS:
1. Name MUST be a SINGLE WORD ONLY - NO compound words, NO combining two words
2. NEVER repeat any name from the forbidden list above
3. Examples of GOOD names: Pepe, Doge, Shiba, Wojak, Mochi, Neko, Luna, Kira, Fren, Bonk
4. Examples of BAD names: WaifuWars, MoonDoge, CatPunk, ShibaKing - NEVER do this
5. Max 10 characters, simple and memorable
6. Ticker should be 3-4 letters derived from the name
7. Be CREATIVE - use trending themes as inspiration but CREATE A NEW UNIQUE NAME

Return ONLY a JSON object with these exact fields (no markdown, no code blocks):
{
  "name": "Single word name only (max 10 chars, NO compound words, MUST BE UNIQUE)",
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
    const rawContent = conceptData.choices?.[0]?.message?.content || "";
    
    console.log("[fun-generate] Raw concept response:", rawContent);

    // Parse JSON response - try to extract from possible markdown code blocks
    let name = "";
    let ticker = "";
    let description = "";
    
    try {
      // Remove potential markdown code blocks
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      name = parsed.name || "";
      ticker = parsed.ticker || "";
      description = parsed.description || "";
    } catch {
      console.error("[fun-generate] Failed to parse concept JSON, using fallback");
      // Fallback to random name
      const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
      name = `${prefix}${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`;
      ticker = name.slice(0, 4).toUpperCase();
      description = `The next ${suffix} to moon! 🚀`;
    }

    // Ensure name is single word and properly formatted
    name = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    ticker = ticker.replace(/[^A-Z0-9]/g, "").slice(0, 5).toUpperCase();

    // Check if name still exists (in case AI ignored our instructions)
    if (existingNames.has(name.toLowerCase())) {
      console.log("[fun-generate] Generated name already exists, creating unique variant");
      const randomSuffix = Math.floor(Math.random() * 999);
      name = `${name}${randomSuffix}`.slice(0, 12);
      ticker = name.slice(0, 4).toUpperCase();
    }

    // If name is still too long or still duplicate, use random fallback
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
    const imagePrompt = `Create a simple meme mascot character for a crypto token called "${name}".

Style: Classic internet meme aesthetic like Pepe frog or Doge. Simple, expressive, memorable.

Requirements:
- Single character on transparent or solid color background
- Cartoon/hand-drawn style with bold outlines
- Big expressive face with funny or smug expression
- Flat colors, no gradients or 3D effects
- No text, no logos, no crypto symbols
- Square format, centered composition

Make it look like a viral meme that could represent a meme coin. Think iconic internet culture mascots.`;

    console.log("[fun-generate] Generating image with retry logic...");

    // Use retry logic for image generation
    const imageUrl = await generateImageWithRetry(imagePrompt, 3);

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
