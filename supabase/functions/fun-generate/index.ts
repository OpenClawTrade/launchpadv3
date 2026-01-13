import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meme themes for random selection
const MEME_THEMES = [
  "a silly frog", "a based cat", "a moon-bound dog", "a diamond hands ape",
  "a crying pepe", "a gigachad", "a wojak", "a doge with sunglasses",
  "a laser-eyed cat", "a rocket ship hamster", "a penguin in a suit",
  "a chad wojak", "a smug pepe", "a galaxy brain", "a stonks man",
  "a buff doge", "a cheems", "a shiba with a crown", "a frog on a lily pad",
  "a cat in space", "a golden retriever millionaire", "a chad penguin",
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

    // Step 1: Generate meme concept (name, ticker, description)
    const randomTheme = MEME_THEMES[Math.floor(Math.random() * MEME_THEMES.length)];
    
    const conceptPrompt = `Create a funny viral meme coin concept based on: "${randomTheme}"

Return ONLY a JSON object with these exact fields (no markdown, no code blocks):
{
  "name": "Short catchy name (1-3 words, max 20 chars)",
  "ticker": "3-5 letter ticker in CAPS",
  "description": "Funny one-liner description (max 100 chars)"
}

Make it absurd, internet-culture inspired, and something that would go viral on crypto twitter.`;

    console.log("[fun-generate] Generating concept for theme:", randomTheme);

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
      // Fallback: generate random meme data
      memeData = {
        name: `Based ${randomTheme.split(" ").pop()}`,
        ticker: randomTheme.split(" ").pop()?.slice(0, 4).toUpperCase() || "MEME",
        description: "The most based meme coin on Solana 🚀",
      };
    }

    // Validate and sanitize
    const name = (memeData.name || "Fun Token").slice(0, 20);
    const ticker = (memeData.ticker || "FUN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    const description = (memeData.description || "A fun meme coin!").slice(0, 150);

    console.log("[fun-generate] Parsed concept:", { name, ticker, description });

    // Step 2: Generate circular logo image
    const imagePrompt = `Create a circular meme coin logo for "${name}" ($${ticker}).
Theme: ${randomTheme}
Style: Vibrant colors, bold outlines, cartoonish, memeable, crypto-inspired.
The image MUST be perfectly circular with no background outside the circle.
Make it look like a professional crypto token logo that would go viral.
${description}`;

    console.log("[fun-generate] Generating image...");

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
