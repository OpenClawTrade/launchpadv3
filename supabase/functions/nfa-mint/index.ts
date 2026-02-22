import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TREASURY_WALLET = "HSVmkUnmjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const MINT_PRICE_SOL = 1.0;
const LAMPORTS_PER_SOL = 1_000_000_000;

function validateTokenName(name: string): string | null {
  if (!name || name.trim().length === 0) return "Token name is required";
  if (name.trim().length > 32) return "Token name must be 32 characters or less";
  if (/https?:\/\//i.test(name)) return "Token name cannot contain URLs";
  return null;
}

function validateTokenTicker(ticker: string): string | null {
  if (!ticker || ticker.trim().length === 0) return "Ticker is required";
  const cleaned = ticker.trim().toUpperCase();
  if (cleaned.length > 10) return "Ticker must be 10 characters or less";
  if (!/^[A-Z0-9.]+$/.test(cleaned)) return "Ticker must be alphanumeric (A-Z, 0-9, .)";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { minterWallet, paymentSignature, tokenName, tokenTicker, tokenImageUrl } = await req.json();

    if (!minterWallet || !paymentSignature) {
      return new Response(
        JSON.stringify({ error: "minterWallet and paymentSignature required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate metadata fields
    if (tokenName) {
      const nameError = validateTokenName(tokenName);
      if (nameError) {
        return new Response(
          JSON.stringify({ error: nameError }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (tokenTicker) {
      const tickerError = validateTokenTicker(tokenTicker);
      if (tickerError) {
        return new Response(
          JSON.stringify({ error: tickerError }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (tokenImageUrl && !/^https?:\/\/.+/i.test(tokenImageUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid image URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment on-chain via Helius RPC
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || 
      (heliusApiKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}` : "https://api.mainnet-beta.solana.com");

    const txResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [paymentSignature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });

    const txData = await txResponse.json();
    const tx = txData?.result;

    if (!tx) {
      return new Response(
        JSON.stringify({ error: "Transaction not found. Please wait for confirmation and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tx.meta?.err) {
      return new Response(
        JSON.stringify({ error: "Transaction failed on-chain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SOL transfer to treasury
    const instructions = tx.transaction?.message?.instructions || [];
    let transferVerified = false;

    for (const ix of instructions) {
      if (ix.parsed?.type === "transfer" && ix.program === "system") {
        const info = ix.parsed.info;
        if (
          info.destination === TREASURY_WALLET &&
          info.source === minterWallet &&
          Number(info.lamports) >= MINT_PRICE_SOL * LAMPORTS_PER_SOL * 0.99
        ) {
          transferVerified = true;
          break;
        }
      }
    }

    if (!transferVerified) {
      return new Response(
        JSON.stringify({ error: `Payment of ${MINT_PRICE_SOL} SOL to treasury not found in transaction` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate signature
    const { data: existingMint } = await supabase
      .from("nfa_mints")
      .select("id")
      .eq("payment_signature", paymentSignature)
      .maybeSingle();

    if (existingMint) {
      return new Response(
        JSON.stringify({ error: "This transaction has already been used for an NFA mint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current open batch
    const { data: batch, error: batchError } = await supabase
      .from("nfa_batches")
      .select("*")
      .eq("status", "open")
      .order("batch_number", { ascending: true })
      .limit(1)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: "No open NFA batch available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick a random slot number (1-1000) that hasn't been used yet
    const { data: usedSlots } = await supabase
      .from("nfa_mints")
      .select("slot_number")
      .eq("batch_id", batch.id);

    const usedSet = new Set((usedSlots || []).map((s: any) => s.slot_number));
    const availableSlots: number[] = [];
    for (let i = 1; i <= batch.total_slots; i++) {
      if (!usedSet.has(i)) availableSlots.push(i);
    }

    if (availableSlots.length === 0) {
      return new Response(
        JSON.stringify({ error: "No available slots in this batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newSlotNumber = availableSlots[Math.floor(Math.random() * availableSlots.length)];

    // Mint NFT on-chain using Metaplex Core
    let nfaMintAddress: string | null = null;
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const nfaCollectionAddress = Deno.env.get("NFA_COLLECTION_ADDRESS");

    if (treasuryPrivateKey && nfaCollectionAddress) {
      try {
        const { createUmi } = await import("https://esm.sh/@metaplex-foundation/umi-bundle-defaults@0.9.2");
        const { mplCore, create } = await import("https://esm.sh/@metaplex-foundation/mpl-core@1.1.1");
        const { generateSigner, createSignerFromKeypair, keypairIdentity, publicKey } = await import("https://esm.sh/@metaplex-foundation/umi@0.9.2");
        const bs58Module = await import("https://esm.sh/bs58@6.0.0");
        const bs58 = bs58Module.default || bs58Module;

        const umi = createUmi(rpcUrl).use(mplCore());
        const secretKeyBytes = bs58.decode(treasuryPrivateKey);
        const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKeyBytes);
        const signer = createSignerFromKeypair(umi, umiKeypair);
        umi.use(keypairIdentity(signer));

        // Upload NFT metadata JSON
        const nftMetadata = {
          name: `NFA #${newSlotNumber}`,
          description: `Non-Fungible Agent #${newSlotNumber} on Solana`,
          image: tokenImageUrl || "",
          external_url: `https://clawmode.lovable.app/nfa`,
          attributes: [
            { trait_type: "Token Name", value: tokenName || "Unnamed" },
            { trait_type: "Ticker", value: tokenTicker?.toUpperCase() || "N/A" },
            { trait_type: "Slot", value: newSlotNumber },
            { trait_type: "Batch", value: batch.batch_number },
          ],
        };

        const metadataBlob = new Blob([JSON.stringify(nftMetadata)], { type: "application/json" });
        const metadataPath = `nfa/metadata-${newSlotNumber}-${crypto.randomUUID()}.json`;
        
        await supabase.storage
          .from("post-images")
          .upload(metadataPath, metadataBlob, { upsert: false, contentType: "application/json" });

        const metadataUrl = `${supabaseUrl}/storage/v1/object/public/post-images/${metadataPath}`;

        // Create NFT asset
        const assetSigner = generateSigner(umi);

        await create(umi, {
          asset: assetSigner,
          name: `NFA #${newSlotNumber}`,
          uri: metadataUrl,
          owner: publicKey(minterWallet),
          collection: publicKey(nfaCollectionAddress),
          plugins: [
            {
              type: "TransferDelegate",
              authority: { type: "Address", address: signer.publicKey },
            },
          ],
        }).sendAndConfirm(umi);

        nfaMintAddress = assetSigner.publicKey.toString();
      } catch (e) {
        console.error("On-chain NFT mint failed (continuing with DB record):", e);
      }
    }

    // Insert mint record
    const { data: mint, error: mintError } = await supabase
      .from("nfa_mints")
      .insert({
        batch_id: batch.id,
        slot_number: newSlotNumber,
        minter_wallet: minterWallet,
        payment_signature: paymentSignature,
        payment_verified: true,
        status: "paid",
        nfa_mint_address: nfaMintAddress,
        token_name: tokenName?.trim() || null,
        token_ticker: tokenTicker?.trim().toUpperCase() || null,
        token_image_url: tokenImageUrl || null,
        metadata_locked: true,
        owner_wallet: minterWallet,
      })
      .select()
      .single();

    if (mintError) {
      console.error("Mint insert error:", mintError);
      return new Response(
        JSON.stringify({ error: "Failed to record mint: " + mintError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment batch counter
    const newCount = newSlotNumber;
    const batchUpdate: Record<string, unknown> = { minted_count: newCount };

    if (newCount >= batch.total_slots) {
      batchUpdate.status = "generating";
      batchUpdate.generation_started_at = new Date().toISOString();
    }

    await supabase
      .from("nfa_batches")
      .update(batchUpdate)
      .eq("id", batch.id);

    return new Response(
      JSON.stringify({
        success: true,
        mint: {
          id: mint.id,
          slotNumber: newSlotNumber,
          batchNumber: batch.batch_number,
          totalSlots: batch.total_slots,
          mintedCount: newCount,
          nfaMintAddress,
          tokenName: tokenName?.trim() || null,
          tokenTicker: tokenTicker?.trim().toUpperCase() || null,
          tokenImageUrl: tokenImageUrl || null,
          status: newCount >= batch.total_slots ? "batch_full" : "minted",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA mint error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
