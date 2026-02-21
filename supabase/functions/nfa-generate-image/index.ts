import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenName, tokenTicker } = await req.json();

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a themed prompt
    const nameHint = tokenName ? ` themed around "${tokenName}"` : "";
    const tickerHint = tokenTicker ? ` with the ticker "$${tokenTicker}"` : "";
    const prompt = `Generate a unique, high-quality avatar for a Non-Fungible Agent (NFA) — an autonomous AI trading agent on Solana${nameHint}${tickerHint}. The style should be futuristic, cyberpunk-inspired with neon green (#4ade80) accents on a dark background. Make it look like a premium NFT profile picture — bold, iconic, and memorable. Square 1:1 aspect ratio. No text or letters in the image.`;

    // Call Lovable AI gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errText);
      return new Response(
        JSON.stringify({ error: "AI image generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const imageDataUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ error: "No image returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract base64 and upload to storage
    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return new Response(
        JSON.stringify({ error: "Invalid image format from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageFormat = base64Match[1];
    const base64Data = base64Match[2];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `nfa/generated-${crypto.randomUUID()}.${imageFormat}`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, bytes, {
        contentType: `image/${imageFormat}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload generated image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = `${supabaseUrl}/storage/v1/object/public/post-images/${fileName}`;

    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA generate image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
