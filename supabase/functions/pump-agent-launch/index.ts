// PUMP Agent Launch - Creates tokens on pump.fun via PumpPortal API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PumpPortal API for token creation
const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";

// Generate a proper Ed25519 keypair for the mint using Solana's Keypair
function generateMintKeypair(): { keypair: Keypair; secretKeyBase58: string } {
  const keypair = Keypair.generate();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  return { keypair, secretKeyBase58 };
}

// Parse deployer keypair from private key (supports JSON array or base58 format)
function parseDeployerKeypair(privateKey: string): Keypair {
  try {
    if (privateKey.startsWith("[")) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    } else {
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, ticker, description, imageUrl, twitter, telegram, website, initialBuySol = 0.01 } = await req.json();

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

    // Set website to SubTuna page if not provided
    const finalWebsite = website || `https://tuna.fun/t/${ticker.toUpperCase()}`;
    const finalTwitter = twitter || "https://x.com/BuildTuna";

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

    // Parse deployer keypair to get public key
    const deployerKeypair = parseDeployerKeypair(deployerPrivateKey);
    const deployerPublicKey = deployerKeypair.publicKey.toBase58();
    console.log("[pump-agent-launch] Deployer public key:", deployerPublicKey);

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
    formData.append("twitter", finalTwitter);
    formData.append("website", finalWebsite);
    if (telegram) {
      formData.append("telegram", telegram);
    }
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
    
    // Generate proper Ed25519 mint keypair
    const mintKeypair = generateMintKeypair();
    const mintAddress = mintKeypair.keypair.publicKey.toBase58();
    console.log("[pump-agent-launch] Mint address:", mintAddress);

    const createPayload = {
      publicKey: deployerPublicKey, // Deployer wallet PUBLIC key (not private!)
      action: "create",
      tokenMetadata: {
        name: name,
        symbol: ticker.toUpperCase(),
        uri: metadataUri,
      },
      mint: mintKeypair.secretKeyBase58, // Mint keypair secret for signing
      denominatedInSol: "true",
      amount: initialBuySol, // Initial dev buy
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    };

    console.log("[pump-agent-launch] PumpPortal payload:", JSON.stringify({
      ...createPayload,
      mint: "[REDACTED]",
    }));

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
        creator_wallet: deployerPublicKey,
        deployer_wallet: deployerPublicKey,
        status: "active",
        launchpad_type: "pumpfun",
        pumpfun_signature: createResult.signature,
        pumpfun_creator: deployerPublicKey,
        price_sol: 0.00000003, // Default initial price
        market_cap_sol: 30, // pump.fun starting mcap
        bonding_progress: 0,
        holder_count: 1, // Deployer is first holder
        total_fees_earned: 0,
        total_fees_claimed: 0,
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
