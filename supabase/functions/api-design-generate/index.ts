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
    const systemPrompt = `You are a design expert for crypto token launchpad websites. Generate a complete design configuration based on the user's description.

Output a JSON object with the following structure:
{
  "colors": {
    "primary": "#hex color for main buttons and accents",
    "secondary": "#hex color for secondary elements",
    "background": "#hex color for page background",
    "surface": "#hex color for cards and panels",
    "text": "#hex color for main text",
    "textMuted": "#hex color for secondary text",
    "accent": "#hex color for highlights and borders",
    "success": "#hex for positive values",
    "danger": "#hex for negative values"
  },
  "typography": {
    "headingFont": "font family for headings (use Google Fonts)",
    "bodyFont": "font family for body text",
    "logoSize": "text size like 2xl, 3xl, 4xl"
  },
  "layout": {
    "style": "modern | minimal | cyberpunk | retro | neon",
    "borderRadius": "none | sm | md | lg | xl | full",
    "spacing": "compact | normal | spacious",
    "headerPosition": "top | side"
  },
  "branding": {
    "name": "launchpad name from prompt or generic",
    "tagline": "catchy tagline",
    "logoStyle": "text | icon | both"
  },
  "effects": {
    "gradients": true/false,
    "animations": true/false,
    "glowEffects": true/false,
    "particles": true/false
  }
}

Be creative but ensure colors have good contrast and readability. Match the vibe described in the prompt.`;

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
          { 
            role: "user", 
            content: currentDesign 
              ? `Current design: ${JSON.stringify(currentDesign)}\n\nUpdate based on: ${prompt}`
              : `Generate a design for: ${prompt}`
          },
        ],
        response_format: { type: "json_object" },
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
