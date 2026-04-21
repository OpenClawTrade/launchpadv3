// Popshiba Meme Generator — returns { name, ticker, description, imageDataUrl }
// Uses Lovable AI gateway (gemini-2.5-flash for text, gemini-2.5-flash-image for art).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const ANIMALS = [
  "fox cub", "shiba puppy", "frog", "axolotl", "hamster", "raccoon", "ferret",
  "octopus", "capybara", "owlet", "penguin chick", "duckling", "tiger cub",
  "panda cub", "narwhal", "platypus", "sloth", "chinchilla", "lemur", "quokka",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const animal = pick(ANIMALS);
    const seed = Math.random().toString(36).slice(2, 8);

    // 1) Generate name + ticker + description via tool-call (structured)
    const textRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You invent meme-coin identities. Output ONLY via the tool. Be funny, weird, original. Never repeat common ones (PEPE, DOGE, SHIB, WIF, BONK)." },
          { role: "user", content: `Invent a brand-new meme coin starring a ${animal}. Random seed: ${seed}. Make it absurd and ownable.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_coin",
            description: "Emit the meme coin identity.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "1-3 word coin name, Title Case, no quotes." },
                ticker: { type: "string", description: "3-6 chars UPPERCASE letters only, no $." },
                description: { type: "string", description: "One funny sentence, max 140 chars, no hashtags." },
              },
              required: ["name", "ticker", "description"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_coin" } },
      }),
    });

    if (!textRes.ok) {
      const t = await textRes.text();
      console.error("text gen failed:", textRes.status, t);
      if (textRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (textRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`text gen ${textRes.status}`);
    }
    const textJson = await textRes.json();
    const args = textJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { name: string; ticker: string; description: string };
    try { parsed = typeof args === "string" ? JSON.parse(args) : args; } catch { throw new Error("bad tool args"); }
    const name = String(parsed.name || "").trim().slice(0, 32) || "Popshiba";
    const ticker = String(parsed.ticker || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "MEME";
    const description = String(parsed.description || "").trim().slice(0, 240);

    // 2) Generate the meme image — strict Popshiba sticker style + the AI-invented coin
    const imgPrompt = `Bold flat-vector cartoon meme coin mascot in playful sticker style: a goofy ${animal} character representing a meme coin called "${name}" ($${ticker}). Big wide-open laughing mouth, huge sparkly eyes, tongue out, one paw raised in a "let's pump" pose. Thick chunky black outlines (3-4px), no gradients, simple flat color fills. Color palette MUST be exactly: orange #f5a524, deep orange #e8891a, cream #f4e9d2, ink black #0e0b08, soft lime accent #c8e87a. Cartoon meme-coin energy — silly, exaggerated, hand-drawn sticker vibes. Small starburst and sparkle accents around the head. Centered character, perfectly square 1:1 composition, on a solid cream #f4e9d2 background with a tiny subtle dotted grid texture. NO photorealism, NO 3D, NO neon, NO purple, NO blur, NO text, NO letters, NO watermarks. Pure 2D vector sticker illustration.`;

    const imgRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imgPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!imgRes.ok) {
      const t = await imgRes.text();
      console.error("image gen failed:", imgRes.status, t);
      if (imgRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (imgRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`image gen ${imgRes.status}`);
    }
    const imgJson = await imgRes.json();
    const imageDataUrl: string | undefined = imgJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) throw new Error("no image returned");

    return new Response(
      JSON.stringify({ success: true, name, ticker, description, imageDataUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[popshiba-meme-gen]", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
