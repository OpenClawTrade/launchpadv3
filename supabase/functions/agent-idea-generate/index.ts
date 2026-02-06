import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// TUNA-themed meme concepts for random generation
const TUNA_CONCEPTS = [
  { theme: "astronaut", description: "TUNA in a spacesuit floating among stars" },
  { theme: "cyberpunk", description: "Neon-lit TUNA with glowing eyes and tech accessories" },
  { theme: "samurai", description: "TUNA wielding a katana in feudal Japan style" },
  { theme: "wizard", description: "TUNA with a magical staff and wizard hat" },
  { theme: "DJ", description: "TUNA at a DJ booth with headphones" },
  { theme: "pirate", description: "TUNA captain with eye patch and treasure" },
  { theme: "detective", description: "TUNA with magnifying glass and detective hat" },
  { theme: "superhero", description: "Caped TUNA flying through the city" },
  { theme: "chef", description: "TUNA in a chef hat with cooking utensils" },
  { theme: "gamer", description: "TUNA with VR headset and gaming setup" },
  { theme: "rockstar", description: "TUNA with electric guitar on stage" },
  { theme: "pharaoh", description: "Ancient Egyptian TUNA with golden accessories" },
  { theme: "ninja", description: "Stealthy TUNA with throwing stars" },
  { theme: "viking", description: "TUNA warrior with horned helmet" },
  { theme: "scientist", description: "TUNA in lab coat with bubbling potions" },
];

// Background color palettes for variation
const COLOR_PALETTES = [
  { primary: "#FF6B6B", secondary: "#4ECDC4" }, // Coral + Teal
  { primary: "#6C5CE7", secondary: "#A8E6CF" }, // Purple + Mint
  { primary: "#FDCB6E", secondary: "#E17055" }, // Yellow + Orange
  { primary: "#00B894", secondary: "#55EFC4" }, // Green duo
  { primary: "#0984E3", secondary: "#74B9FF" }, // Blue duo
  { primary: "#E84393", secondary: "#FD79A8" }, // Pink duo
  { primary: "#2D3436", secondary: "#636E72" }, // Dark mode
  { primary: "#00CEC9", secondary: "#81ECEC" }, // Cyan duo
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { prompt, includeTunaLogo } = await req.json().catch(() => ({}));
    
    // Select random concept or use user prompt
    const randomConcept = TUNA_CONCEPTS[Math.floor(Math.random() * TUNA_CONCEPTS.length)];
    const randomPalette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    
    const themeToUse = prompt?.trim() || randomConcept.theme;
    const descriptionContext = prompt?.trim() 
      ? `User's idea: "${prompt}"`
      : `Theme: ${randomConcept.theme} - ${randomConcept.description}`;

    console.log("[agent-idea-generate] Generating concept:", themeToUse);

    // Step 1: Generate token concept with AI
    const conceptPrompt = `Create a meme token concept based on TUNA sushi mascot.

${descriptionContext}

The TUNA mascot is a cute kawaii tuna sushi character with:
- A pink/salmon colored tuna fish slice on top
- White rice body with a cute smiling face
- Rosy cheeks and friendly expression

Create a UNIQUE variation of this character for the given theme/idea.

Return ONLY a JSON object (no markdown):
{
  "name": "Creative single-word token name (max 10 chars)",
  "ticker": "3-4 letter ticker in CAPS",
  "description": "Catchy description with emoji (max 80 chars)",
  "imagePrompt": "Detailed image generation prompt describing the TUNA mascot in the themed style",
  "tweetText": "Viral tweet announcing this token (include @buildtuna mention, emojis, max 280 chars)"
}`;

    const conceptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: conceptPrompt }],
      }),
    });

    if (!conceptResponse.ok) {
      throw new Error("Failed to generate concept");
    }

    const conceptData = await conceptResponse.json();
    const rawContent = conceptData.choices?.[0]?.message?.content || "";
    
    // Parse JSON
    let concept: any;
    try {
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      concept = JSON.parse(jsonStr);
    } catch {
      // Fallback concept
      concept = {
        name: "TunaMax",
        ticker: "TMAX",
        description: "The ultimate TUNA experience! 🍣🚀",
        imagePrompt: `Cute kawaii tuna sushi character as a ${themeToUse}`,
        tweetText: `Introducing $TMAX - The ultimate TUNA experience! 🍣🚀\n\nPowered by @buildtuna\n\n#Solana #Memecoins`,
      };
    }

    console.log("[agent-idea-generate] Concept generated:", concept.name);

    // Step 2: Generate image with the TUNA mascot
    const imagePrompt = `Create a meme token logo featuring a cute kawaii TUNA sushi mascot character.

The character MUST be based on this exact design:
- A cute tuna nigiri sushi with pink/salmon fish on top
- White rice body with an adorable smiling kawaii face
- Big cute eyes, small happy smile, rosy pink cheeks
- Friendly and approachable expression

Theme/Variation: ${concept.imagePrompt || themeToUse}
Background: Solid color gradient using ${randomPalette.primary} and ${randomPalette.secondary}

Style requirements:
- Cartoon/anime kawaii style
- Clean vector-like illustration
- The TUNA sushi character should be the main focus
- Square format, centered composition
- No text, no letters, no words in the image
- Vibrant and eye-catching colors

Make the character look fun, memorable, and perfect for a crypto meme token!`;

    console.log("[agent-idea-generate] Generating image...");

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("[agent-idea-generate] Image generation failed:", errorText);
      throw new Error("Failed to generate image");
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("[agent-idea-generate] No image URL in response");
      throw new Error("No image generated");
    }

    console.log("[agent-idea-generate] Image generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        meme: {
          name: concept.name?.replace(/[^a-zA-Z]/g, "").slice(0, 10) || "TunaMax",
          ticker: concept.ticker?.replace(/[^A-Z]/g, "").slice(0, 5) || "TMAX",
          description: concept.description || "TUNA to the moon! 🍣🚀",
          imageUrl,
          tweetText: concept.tweetText || `Introducing $${concept.ticker} - ${concept.description}\n\nPowered by @buildtuna 🍣`,
          theme: themeToUse,
          palette: randomPalette,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[agent-idea-generate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
