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
    const { adminSecret } = await req.json();

    // Admin gate
    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!adminSecret || adminSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");

    if (!treasuryPrivateKey || !heliusRpcUrl) {
      return new Response(
        JSON.stringify({ error: "Missing TREASURY_PRIVATE_KEY or HELIUS_RPC_URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import Metaplex Core + Umi
    const { createUmi } = await import("https://esm.sh/@metaplex-foundation/umi-bundle-defaults@0.9.2");
    const { mplCore, createCollection } = await import("https://esm.sh/@metaplex-foundation/mpl-core@1.1.1");
    const { generateSigner, createSignerFromKeypair, keypairIdentity } = await import("https://esm.sh/@metaplex-foundation/umi@0.9.2");
    const bs58Module = await import("https://esm.sh/bs58@6.0.0");
    const bs58 = bs58Module.default || bs58Module;

    // Setup Umi
    const umi = createUmi(heliusRpcUrl).use(mplCore());

    // Load treasury keypair
    const secretKeyBytes = bs58.decode(treasuryPrivateKey);
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKeyBytes);
    const signer = createSignerFromKeypair(umi, umiKeypair);
    umi.use(keypairIdentity(signer));

    // Upload collection metadata JSON to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const collectionMetadata = {
      name: "Non-Fungible Agents",
      symbol: "NFA",
      description: "The first NFA standard on Solana — 1,000 autonomous AI trading agents that earn, trade & evolve. Each NFA is a unique digital business with its own token, community, and fee streams.",
      image: "https://ptwytypavumcrbofspno.supabase.co/storage/v1/object/public/post-images/nfa-collection.png",
      external_url: "https://clawmode.lovable.app/nfa",
    };

    const metadataBlob = new Blob([JSON.stringify(collectionMetadata)], { type: "application/json" });
    const metadataPath = `nfa/collection-metadata.json`;

    await supabase.storage
      .from("post-images")
      .upload(metadataPath, metadataBlob, { upsert: true, contentType: "application/json" });

    const metadataUrl = `${supabaseUrl}/storage/v1/object/public/post-images/${metadataPath}`;

    // Create collection on-chain
    const collectionSigner = generateSigner(umi);

    const tx = await createCollection(umi, {
      collection: collectionSigner,
      name: "Non-Fungible Agents",
      uri: metadataUrl,
    }).sendAndConfirm(umi);

    const collectionAddress = collectionSigner.publicKey.toString();

    // Save collection address to all open batches automatically
    const { error: updateError } = await supabase
      .from("nfa_batches")
      .update({ collection_address: collectionAddress })
      .eq("status", "open");

    return new Response(
      JSON.stringify({
        success: true,
        collectionAddress,
        metadataUrl,
        savedToDatabase: !updateError,
        message: updateError 
          ? "Collection created but failed to save to DB: " + updateError.message
          : "Collection created and saved to all open batches automatically!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA collection creation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
