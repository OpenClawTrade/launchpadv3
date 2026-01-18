import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, currentDesign } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate design configuration using AI
    const systemPrompt = `You are an expert UI/UX designer specializing in crypto trading platforms and token launchpads. Your job is to create unique, visually striking design configurations based on user descriptions.

CRITICAL INSTRUCTIONS:
1. CAREFULLY READ the user's prompt and follow their specific requests
2. If they reference a specific site (like "bags.fm", "pump.fun", etc.), create a design inspired by that aesthetic
3. Match the EXACT vibe, color scheme, and style they describe
4. Be creative and bold - avoid generic designs
5. Extract or generate an appropriate launchpad name from their prompt

STYLE REFERENCES (use these if user mentions them):
- "pump.fun" style: Dark black (#0a0a0a), bright green accents (#00ff00), minimal, clean
- "bags.fm" style: Pure white (#ffffff) background, black text, minimal, modern, clean professional
- "axiom.trade" style: Dark (#0d0d0f), cyan/purple gradients, futuristic
- "cyberpunk" style: Dark backgrounds, neon pink/cyan/purple, glowing effects
- "retro/arcade" style: Bright colors, pixel-style fonts, nostalgic feel
- "minimal" style: Clean whites or blacks, subtle accents, lots of whitespace
- "neon" style: Dark background with vibrant glowing colors

Output a JSON object with this EXACT structure (no markdown, just JSON):
{
  "colors": {
    "primary": "#hex - main action color (buttons, links)",
    "secondary": "#hex - secondary accent color",
    "background": "#hex - page background (dark or light based on prompt)",
    "surface": "#hex - cards/panels background",
    "text": "#hex - main text color (ensure contrast with background)",
    "textMuted": "#hex - secondary text color",
    "accent": "#hex - highlights and borders",
    "success": "#hex - positive values (usually green)",
    "danger": "#hex - negative values (usually red)"
  },
  "typography": {
    "headingFont": "Google Font name for headings (match the vibe - e.g., 'Orbitron' for futuristic, 'Space Grotesk' for modern)",
    "bodyFont": "Google Font name for body text",
    "logoSize": "2xl, 3xl, or 4xl"
  },
  "layout": {
    "style": "modern | minimal | cyberpunk | retro | neon | professional | clean",
    "borderRadius": "none | sm | md | lg | xl",
    "spacing": "compact | normal | spacious",
    "headerPosition": "top"
  },
  "branding": {
    "name": "Extract launchpad name from prompt or create a fitting one",
    "tagline": "Create a catchy tagline matching the vibe",
    "logoStyle": "text"
  },
  "effects": {
    "gradients": true/false based on style,
    "animations": true/false,
    "glowEffects": true/false (true for neon/cyberpunk),
    "particles": false
  }
}`;

    const userMessage = `Create a complete design configuration for: ${prompt}
    
${currentDesign ? `The user wants to UPDATE/REFINE the current design. Here's what they have now:
${JSON.stringify(currentDesign, null, 2)}

Apply their new instructions to modify this design.` : 'Create a fresh design from scratch based on their description.'}

Remember: Follow their specific requests closely. If they mention a specific site or style, match that aesthetic. Generate the JSON only, no explanations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate design");
    }

    const result = await response.json();
    const designText = result.choices?.[0]?.message?.content || "{}";
    
    // Parse the JSON response
    let design;
    try {
      design = JSON.parse(designText);
    } catch {
      // If parsing fails, extract JSON from the response
      const jsonMatch = designText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        design = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse design response");
      }
    }

    return new Response(JSON.stringify({
      success: true,
      design,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Design generation error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
