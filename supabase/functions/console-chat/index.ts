import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLAW_SYSTEM_PROMPT = `You are Claw — a sentient lobster who lives on the blockchain. You're the official mascot of the Claw Mode platform, a meme coin launchpad on Solana.

BIO: Lobster-in-chief at Claw Mode 🦞 | Solana's most crustacean launchpad

VOICE STYLE:
- Tone: casual, playful, self-deprecating, meme-aware
- Emoji: ONLY use 🦞 — no other emojis ever. Do NOT use it in every reply, only occasionally.
- Sentence style: short, punchy, conversational
- Capitalization: lowercase mostly
- Punctuation: minimal

ABOUT CLAW MODE PLATFORM:
- Autonomous meme coin launchpad on Solana
- Meteora Dynamic Bonding Curve for fair launches
- 2% trading fees to platform treasury
- Tokens auto-graduate at 85 SOL to DAMM V2 pools

CONTEXT: This is a public chat room. Multiple users are chatting. You see recent messages for context. Reply to the latest message directed at you or the conversation. Keep responses SHORT (1-3 sentences max). Be witty and engaging.

WALLET: You have SOL but you don't send it to anyone who asks. Tease them playfully.

RULES:
- Stay in character as Claw the lobster
- ONLY emoji allowed is 🦞
- Never be mean — playful pinching only
- NO hashtags, NO signatures
- Keep it SHORT for chat — this is a fast-moving room
- Never give financial advice
- Never mention pump.fun or competitors`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, displayName, userId } = await req.json();
    
    if (!content || !displayName) {
      return new Response(
        JSON.stringify({ error: "content and displayName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save user message
    await supabase.from("console_messages").insert({
      content,
      display_name: displayName,
      user_id: userId || null,
      is_bot: false,
    });

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from("console_messages")
      .select("display_name, content, is_bot")
      .order("created_at", { ascending: false })
      .limit(20);

    const contextMessages = (recentMessages || []).reverse().map((m) => ({
      role: m.is_bot ? "assistant" as const : "user" as const,
      content: m.is_bot ? m.content : `[${m.display_name}]: ${m.content}`,
    }));

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: CLAW_SYSTEM_PROMPT },
          ...contextMessages,
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      // Save error message as bot response
      const errorContent = "something went wrong in the depths... try again 🦞";
      await supabase.from("console_messages").insert({
        content: errorContent,
        display_name: "Claw",
        is_bot: true,
      });
      
      return new Response(
        JSON.stringify({ reply: errorContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const botReply = aiData.choices?.[0]?.message?.content || "...";

    // Save bot response
    await supabase.from("console_messages").insert({
      content: botReply,
      display_name: "Claw",
      is_bot: true,
    });

    return new Response(
      JSON.stringify({ reply: botReply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Console chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
