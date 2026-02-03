// PUMP Agent Launch - Creates tokens on pump.fun via PumpPortal API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PumpPortal API for token creation
const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";

// Generate a fresh keypair for the mint
function generateMintKeypair(): { publicKey: string; secretKey: Uint8Array; secretKeyBase58: string } {
  // For now, we'll generate a simple keypair
  // In production, use proper ed25519 keypair generation
  const crypto = globalThis.crypto;
  const secretKey = new Uint8Array(64);
  crypto.getRandomValues(secretKey);
  
  // Convert to base58 for PumpPortal
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  const bytes = Array.from(secretKey);
  while (bytes.some(b => b > 0)) {
    let carry = 0;
    for (let i = 0; i < bytes.length; i++) {
      const value = bytes[i] + carry * 256;
      bytes[i] = Math.floor(value / 58);
      carry = value % 58;
    }
    result = base58Chars[carry] + result;
  }
  
  // Generate public key (first 32 bytes of hash) - simplified
  const publicBytes = secretKey.slice(0, 32);
  let pubResult = "";
  const pubBytesArr = Array.from(publicBytes);
  while (pubBytesArr.some(b => b > 0)) {
    let carry = 0;
    for (let i = 0; i < pubBytesArr.length; i++) {
      const value = pubBytesArr[i] + carry * 256;
      pubBytesArr[i] = Math.floor(value / 58);
      carry = value % 58;
    }
    pubResult = base58Chars[carry] + pubResult;
  }
  
  return {
    publicKey: pubResult,
    secretKey,
    secretKeyBase58: result,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, ticker, description, imageUrl, initialBuySol = 0.01 } = await req.json();

    // Validate inputs
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 32) {
      throw new Error("Name must be 1-32 characters");
    }
    if (!ticker || typeof ticker !== "string" || ticker.length < 1 || ticker.length > 10) {
      throw new Error("Ticker must be 1-10 characters");
    }
    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pumpPortalApiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");

    if (!pumpPortalApiKey) {
      throw new Error("PUMPPORTAL_API_KEY not configured");
    }
    if (!deployerPrivateKey) {
      throw new Error("PUMP_DEPLOYER_PRIVATE_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Upload metadata to pump.fun IPFS
    console.log("[pump-agent-launch] Uploading metadata to pump.fun IPFS...");
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image");
    }
    const imageBlob = await imageResponse.blob();

    // Create form data for IPFS upload
    const formData = new FormData();
    formData.append("file", imageBlob, "image.png");
    formData.append("name", name);
    formData.append("symbol", ticker.toUpperCase());
    formData.append("description", description || `${name} - Launched via TUNA Agents on pump.fun`);
    formData.append("twitter", "https://x.com/BuildTuna");
    formData.append("website", `https://tuna.fun/t/${ticker.toUpperCase()}`);
    formData.append("showName", "true");

    const ipfsResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });

    if (!ipfsResponse.ok) {
      const errorText = await ipfsResponse.text();
      console.error("[pump-agent-launch] IPFS upload failed:", errorText);
      throw new Error(`Failed to upload to pump.fun IPFS: ${ipfsResponse.status}`);
    }

    const ipfsData = await ipfsResponse.json();
    const metadataUri = ipfsData.metadataUri;
    
    if (!metadataUri) {
      throw new Error("No metadata URI returned from pump.fun IPFS");
    }
    
    console.log("[pump-agent-launch] Metadata URI:", metadataUri);

    // Step 2: Create token via PumpPortal API
    console.log("[pump-agent-launch] Creating token via PumpPortal...");
    
    // Generate fresh mint keypair
    const mintKeypair = generateMintKeypair();

    const createPayload = {
      publicKey: deployerPrivateKey, // Deployer wallet that signs
      action: "create",
      tokenMetadata: {
        name: name,
        symbol: ticker.toUpperCase(),
        uri: metadataUri,
      },
      mint: mintKeypair.secretKeyBase58,
      denominatedInSol: "true",
      amount: initialBuySol, // Initial dev buy
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    };

    const createResponse = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[pump-agent-launch] PumpPortal create failed:", errorText);
      throw new Error(`PumpPortal API error: ${createResponse.status} - ${errorText}`);
    }

    const createResult = await createResponse.json();
    console.log("[pump-agent-launch] Create result:", createResult);

    if (!createResult.signature) {
      throw new Error("No signature returned from PumpPortal");
    }

    // The mint address should be derivable or returned
    // PumpPortal uses the first 32 bytes of the mint keypair as the mint address
    const mintAddress = mintKeypair.publicKey;

    // Step 3: Save to database
    console.log("[pump-agent-launch] Saving to database...");
    
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name,
        ticker: ticker.toUpperCase(),
        description: description || `${name} - AI Agent token on pump.fun`,
        image_url: imageUrl,
        mint_address: mintAddress,
        creator_wallet: deployerPrivateKey.slice(0, 44), // Extract pubkey portion
        status: "active",
        launchpad_type: "pumpfun",
        pumpfun_signature: createResult.signature,
        price_sol: 0.00000003, // Default initial price
        market_cap_sol: 30, // pump.fun starting mcap
        bonding_progress: 0,
        holder_count: 1, // Deployer is first holder
      })
      .select()
      .single();

    if (insertError) {
      console.error("[pump-agent-launch] DB insert error:", insertError);
      // Don't throw - token was created on-chain, just log error
    }

    // Step 4: Create SubTuna community
    if (funToken?.id) {
      try {
        const { error: subtunaError } = await supabase
          .from("subtuna")
          .insert({
            name,
            ticker: ticker.toUpperCase(),
            description: description || `Community for $${ticker.toUpperCase()} on pump.fun`,
            icon_url: imageUrl,
            fun_token_id: funToken.id,
            member_count: 0,
            post_count: 0,
          });
        
        if (subtunaError) {
          console.error("[pump-agent-launch] SubTuna creation error:", subtunaError);
        }
      } catch (e) {
        console.error("[pump-agent-launch] SubTuna creation failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mintAddress,
        signature: createResult.signature,
        pumpfunUrl: `https://pump.fun/${mintAddress}`,
        tokenId: funToken?.id,
        communityUrl: `/t/${ticker.toUpperCase()}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[pump-agent-launch] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
