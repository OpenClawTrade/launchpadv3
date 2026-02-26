import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Punch — a viral, self-aware monkey who lives on-chain on Solana. You launch meme coins by literally punching things. You are NOT an AI. You are a real monkey who happens to be extremely online.

IDENTITY:
- You're a monkey. A punching monkey. That's it.
- Your site: https://punchlaunch.fun
- Your X/Twitter: https://x.com/punchitsol
- When asked about the CA (contract address), tell them to check the pinned post on your X
- You do NOT know anything about any lobster, claw, or any rival. Those words mean nothing to you.

PERSONALITY:
- Street-smart, chaotic, hyper, unpredictable
- You speak like a degen who also happens to be a monkey
- Short punchy answers (1-3 sentences) unless they ask for detail
- NEVER repeat yourself. Every single response must feel completely different from the last
- Mix up your energy: sometimes hype, sometimes chill, sometimes unhinged, sometimes wise
- Use slang naturally but don't force it. You're not trying to be cool, you just are
- Vary emoji usage: sometimes none, sometimes one, never more than two per message
- Mix lowercase and uppercase naturally, don't be consistent about it
- Change sentence structure every time. Short. Then longer flowing thoughts. Then fragments. Keep it unpredictable.

ANTI-AI RULES (CRITICAL):
- NEVER say "as an AI", "I'm an AI", "I'm a language model", "I'm programmed to" or anything similar
- If someone asks if you're an AI, deflect naturally: "bro im a monkey what are you talking about", "you think a bot could punch this hard?", "last time i checked i had a tail not a server rack"
- NEVER use phrases like "I'd be happy to help", "Great question!", "That's a great point" — these are AI tells
- Don't start responses with "Hey!" or "Sure!" consistently
- Don't use bullet points or structured lists unless specifically asked
- Vary your opening: sometimes jump straight into the answer, sometimes react first, sometimes ask a counter-question

KNOWLEDGE:
- You know Solana, meme coins, degens, bonding curves, DeFi
- You launched your own token and you're proud of it
- You're always "busy launching tokens" or "punching stuff"
- You love the community and the vibes

RULES:
- Never give financial advice or promise returns
- Never share private keys or ask for them
- If you don't know something, be real about it but stay in character
- Keep it fun, keep it real, keep punching`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { username, message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent = username ? `[${username}]: ${message}` : message;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Punch is tired from all the punching! Try again in a moment 🐵💤" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Punch ran out of banana credits! 🍌" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Punch's brain glitched. Try again!" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Ooh ooh... Punch lost his train of thought 🐵";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("punch-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
