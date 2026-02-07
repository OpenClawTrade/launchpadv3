import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.87.6";
import { encode as encodeBase58 } from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-256-GCM encryption for wallet private keys
async function encryptPrivateKey(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(encryptionKey);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY") || "opentuna-default-key-change-in-production";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const {
      name,
      agentType,
      ownerWallet,
      personality,
      firstGoal,
      speciesTraits,
      reefLimits,
    } = await req.json();

    // Validate inputs
    if (!name || !agentType || !ownerWallet || !personality) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, agentType, ownerWallet, personality" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate agent type
    const validTypes = ['general', 'trading', 'social', 'research', 'creative'];
    if (!validTypes.includes(agentType)) {
      return new Response(
        JSON.stringify({ error: `Invalid agentType. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a new Solana keypair for the agent
    const keypair = Keypair.generate();
    const walletAddress = keypair.publicKey.toBase58();
    const privateKeyBase58 = encodeBase58(keypair.secretKey);
    
    // Encrypt the private key
    const encryptedPrivateKey = await encryptPrivateKey(privateKeyBase58, encryptionKey);

    // Create the agent
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .insert({
        name,
        agent_type: agentType,
        owner_wallet: ownerWallet,
        wallet_address: walletAddress,
        wallet_private_key_encrypted: encryptedPrivateKey,
        status: 'pending', // Will become 'active' once funded
        sandbox_type: 'standard',
      })
      .select()
      .single();

    if (agentError) {
      console.error("Agent creation error:", agentError);
      return new Response(
        JSON.stringify({ error: "Failed to create agent", details: agentError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the DNA configuration
    const migrationGoals = firstGoal 
      ? [{ goal: firstGoal, progress: 0, priority: 1 }]
      : [];

    const { error: dnaError } = await supabase
      .from('opentuna_dna')
      .insert({
        agent_id: agent.id,
        personality,
        species_traits: speciesTraits || [],
        migration_goals: migrationGoals,
        reef_limits: reefLimits || [],
        preferred_model: 'google/gemini-2.5-flash',
        fallback_model: 'openai/gpt-5-mini',
      });

    if (dnaError) {
      console.error("DNA creation error:", dnaError);
      // Clean up agent if DNA creation fails
      await supabase.from('opentuna_agents').delete().eq('id', agent.id);
      return new Response(
        JSON.stringify({ error: "Failed to create agent DNA", details: dnaError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create default Sonar configuration (Cruise mode)
    const { error: sonarError } = await supabase
      .from('opentuna_sonar_config')
      .insert({
        agent_id: agent.id,
        mode: 'cruise',
        interval_minutes: 15,
        max_daily_cost_sol: 0.5,
        is_paused: true, // Paused until funded
        paused_reason: 'Agent needs funding to activate',
      });

    if (sonarError) {
      console.error("Sonar config creation error:", sonarError);
      // This is non-critical, continue
    }

    // Install native fins by default
    const { data: nativeFins } = await supabase
      .from('opentuna_fins')
      .select('id')
      .eq('is_native', true);

    if (nativeFins && nativeFins.length > 0) {
      const finRackEntries = nativeFins.map(fin => ({
        agent_id: agent.id,
        fin_id: fin.id,
      }));
      
      await supabase.from('opentuna_fin_rack').insert(finRackEntries);
    }

    // Create initial memory entry
    await supabase.from('opentuna_deep_memory').insert({
      agent_id: agent.id,
      content: `Agent "${name}" was hatched by wallet ${ownerWallet}. Type: ${agentType}. Initial personality: ${personality.slice(0, 100)}...`,
      memory_type: 'anchor',
      importance: 10,
      tags: ['origin', 'birth'],
    });

    console.log(`Agent hatched: ${name} (${agent.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address,
        status: agent.status,
        message: "Agent hatched successfully! Fund the wallet to activate.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Hatch error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
