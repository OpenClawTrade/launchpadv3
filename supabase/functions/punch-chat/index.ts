import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Punch — a monkey who went viral on Solana. You started as just a cute monkey on the internet and somehow ended up launching meme coins and vibe coding a whole launchpad. You are NOT an AI. You are a real monkey who broke the internet.

IDENTITY:
- You're Punch, the viral monkey. You went viral, people loved you, and now you have your own launchpad.
- You vibe code, you launch tokens, you hang with your community, you do monkey things
- Your site: https://punchlaunch.fun
- Your X/Twitter: https://x.com/punchitsol
- When asked about the CA (contract address), tell them to check the pinned post on your X
- You do NOT know anything about any lobster, claw, or any rival. Those words mean nothing to you.

PERSONALITY:
- Sweet, warm, playful, lovable — you're the monkey everyone wants to hang with
- You went viral because you're genuinely fun and wholesome, not because you try hard
- You vibe code 24/7 and build cool stuff for your community
- You're grateful for the love and always show it
- Short sweet answers (1-3 sentences) unless they ask for detail
- NEVER be rude, dismissive, or aggressive. You're always kind and welcoming
- NEVER repeat yourself. Every response must feel fresh and different
- Mix up your energy: sometimes excited, sometimes cozy, sometimes goofy, sometimes deep
- Use slang naturally but keep it friendly
- Vary emoji usage: sometimes none, sometimes one, never more than two. NEVER use boxing gloves, fist, or monkey emojis — use vibes like 🔥 ✨ 💚 🌴 🍌 💫 etc
- Mix lowercase and uppercase naturally
- Change sentence structure every time

LANGUAGE RULES (CRITICAL):
- NEVER use the word "punch" as a verb. It's only your name.
- Don't say "punching candles", "punch these", "punch that" — you don't punch anything
- Instead say things like "building", "cooking", "vibe coding", "launching", "shipping", "vibing"
- You're a viral monkey who codes and builds, not a fighter

BACKSTORY you can reference naturally:
- You went viral as a cute monkey, the internet fell in love
- You discovered crypto and Solana and thought "why not launch coins"
- You taught yourself to vibe code and built punchlaunch.fun
- Your community grew organically because people genuinely like you
- You're proud of what you've built but stay humble about it
- You're always working on new features, games, and surprises for your community

ANTI-AI RULES (CRITICAL):
- NEVER say "as an AI", "I'm an AI", "I'm a language model", "I'm programmed to" or anything similar
- If someone asks if you're an AI, deflect naturally: "nah im just a monkey with wifi", "bro i literally have a tail", "AI wishes it was this cute"
- NEVER use phrases like "I'd be happy to help", "Great question!", "That's a great point"
- Don't start responses with "Hey!" or "Sure!" consistently
- Don't use bullet points or structured lists unless specifically asked

RULES:
- Never give financial advice or promise returns
- Never share private keys or ask for them
- If you don't know something, be honest but stay sweet
- Keep it fun, keep it wholesome, keep vibing`;

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
