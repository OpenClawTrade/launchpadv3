 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 const strategyDetails = {
   conservative: {
     stopLoss: "10%",
     takeProfit: "25%",
     maxPositions: 2,
     style: "calm, analytical, wise expression with reading glasses aesthetic",
     description: "focuses on steady gains with minimal drawdown risk",
   },
   balanced: {
     stopLoss: "20%",
     takeProfit: "50%",
     maxPositions: 3,
     style: "confident, focused, professional trader demeanor",
     description: "moderate risk-reward approach for consistent growth",
   },
   aggressive: {
     stopLoss: "30%",
     takeProfit: "100%",
     maxPositions: 5,
     style: "fierce, determined, bold with intense expression",
     description: "high-conviction plays targeting exponential returns",
   },
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const { strategy, personalityPrompt } = await req.json();
 
     if (!strategy || !strategyDetails[strategy as keyof typeof strategyDetails]) {
       return new Response(
         JSON.stringify({ error: "Valid strategy is required (conservative, balanced, aggressive)" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const details = strategyDetails[strategy as keyof typeof strategyDetails];
 
     // Step 1: Generate text (name, ticker, description)
     const textPrompt = `Generate a professional trading agent identity for a ${strategy} strategy autonomous trading bot.
 
 Requirements:
 - Name: A professional trading-themed name (examples: "AlphaQuant", "Sentinel", "VeloTrade", "ApexHunter", "Finwise", "TunaShark")
 - Ticker: 3-5 uppercase characters derived from the name
 - Description: A professional 2-3 sentence description that:
   1. Explains the trading strategy with exact parameters: ${details.stopLoss} stop-loss, ${details.takeProfit} take-profit, max ${details.maxPositions} positions
   2. Describes what this agent will do (scan for opportunities, manage risk, execute trades on Solana)
   3. Uses professional financial terminology (risk-reward, conviction, momentum, asymmetric upside)
   4. NO EMOJIS - strictly professional tone
   5. Must mention the exact stop-loss and take-profit percentages
 
 ${personalityPrompt ? `Personality hint: ${personalityPrompt}` : ""}
 
 Return ONLY valid JSON with no markdown: {"name": "...", "ticker": "...", "description": "..."}`;
 
     const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-2.5-flash",
         messages: [{ role: "user", content: textPrompt }],
       }),
     });
 
     if (!textResponse.ok) {
       const errorText = await textResponse.text();
       console.error("Text generation failed:", errorText);
       throw new Error("Failed to generate agent identity");
     }
 
     const textData = await textResponse.json();
     const textContent = textData.choices?.[0]?.message?.content || "";
     
     // Parse JSON from response
     let agentIdentity: { name: string; ticker: string; description: string };
     try {
       // Try to extract JSON from the response
       const jsonMatch = textContent.match(/\{[\s\S]*\}/);
       if (jsonMatch) {
         agentIdentity = JSON.parse(jsonMatch[0]);
       } else {
         throw new Error("No JSON found in response");
       }
     } catch (parseError) {
       console.error("Failed to parse text response:", textContent);
       // Fallback to generated defaults
       agentIdentity = {
         name: strategy === "aggressive" ? "ApexHunter" : strategy === "balanced" ? "VeloTrade" : "Sentinel",
         ticker: strategy === "aggressive" ? "APEX" : strategy === "balanced" ? "VELO" : "STNL",
         description: `This agent employs a ${strategy} trading strategy with ${details.stopLoss} stop-loss and ${details.takeProfit} take-profit thresholds. Managing up to ${details.maxPositions} concurrent positions, it scans Solana markets for high-probability setups with favorable risk-reward profiles.`,
       };
     }
 
     // Step 2: Generate avatar image
     const imagePrompt = `Create a professional trading AI agent mascot inspired by tuna fish themes.
 
 Style requirements:
 - Professional trading aesthetic with subtle chart or data elements in background
 - Teal and cyan primary color palette (brand colors)
 - Clean, modern design suitable for a financial trading platform
 - ${strategy.toUpperCase()} personality: ${details.style}
 - Single character, centered composition
 - Solid dark background (navy or dark teal)
 - No text, no logos, cartoon mascot style with professional polish
 - The character should look like an expert crypto trader mascot
 - Fish/tuna inspired but anthropomorphized and professional
 
 Ultra high resolution, digital art style.`;
 
     let avatarUrl: string | null = null;
 
     try {
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
 
       if (imageResponse.ok) {
         const imageData = await imageResponse.json();
         const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
 
         if (imageBase64 && imageBase64.startsWith("data:image")) {
           // Upload to Supabase storage
           const supabase = createClient(
             Deno.env.get("SUPABASE_URL")!,
             Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
           );
 
           // Extract base64 data and convert to Uint8Array
           const base64Data = imageBase64.split(",")[1];
           const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
 
           const fileName = `${agentIdentity.ticker.toLowerCase()}-${Date.now()}.png`;
 
           const { error: uploadError } = await supabase.storage
             .from("trading-agents")
             .upload(fileName, binaryData, {
               contentType: "image/png",
               upsert: false,
             });
 
           if (!uploadError) {
             const { data: urlData } = supabase.storage
               .from("trading-agents")
               .getPublicUrl(fileName);
             avatarUrl = urlData.publicUrl;
           } else {
             console.error("Upload error:", uploadError);
           }
         }
       } else {
         console.error("Image generation failed:", await imageResponse.text());
       }
     } catch (imageError) {
       console.error("Image generation error:", imageError);
       // Continue without avatar - it's optional
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         name: agentIdentity.name,
         ticker: agentIdentity.ticker.toUpperCase(),
         description: agentIdentity.description,
         avatarUrl,
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("trading-agent-generate error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });