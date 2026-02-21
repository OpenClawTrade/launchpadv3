import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LAMPORTS_PER_SOL = 1_000_000_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyerWallet, listingId, paymentSignature } = await req.json();

    if (!buyerWallet || !listingId || !paymentSignature) {
      return new Response(
        JSON.stringify({ error: "buyerWallet, listingId, and paymentSignature required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get listing
    const { data: listing, error: listError } = await supabase
      .from("nfa_listings")
      .select("*")
      .eq("id", listingId)
      .eq("status", "active")
      .single();

    if (listError || !listing) {
      return new Response(
        JSON.stringify({ error: "Active listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (listing.seller_wallet === buyerWallet) {
      return new Response(
        JSON.stringify({ error: "Cannot buy your own listing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment on-chain
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

    if (!tx || tx.meta?.err) {
      return new Response(
        JSON.stringify({ error: "Transaction not found or failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SOL transfer to seller
    const instructions = tx.transaction?.message?.instructions || [];
    let transferVerified = false;

    for (const ix of instructions) {
      if (ix.parsed?.type === "transfer" && ix.program === "system") {
        const info = ix.parsed.info;
        if (
          info.destination === listing.seller_wallet &&
          info.source === buyerWallet &&
          Number(info.lamports) >= listing.asking_price_sol * LAMPORTS_PER_SOL * 0.99
        ) {
          transferVerified = true;
          break;
        }
      }
    }

    if (!transferVerified) {
      return new Response(
        JSON.stringify({ error: `Payment of ${listing.asking_price_sol} SOL to seller not found in transaction` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transfer NFT on-chain using Transfer Delegate
    let nftTransferSig = null;
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const nfaCollectionAddress = Deno.env.get("NFA_COLLECTION_ADDRESS");

    // Get the mint record for the NFT address
    const { data: nfaMint } = await supabase
      .from("nfa_mints")
      .select("nfa_mint_address")
      .eq("id", listing.nfa_mint_id)
      .single();

    if (treasuryPrivateKey && nfaMint?.nfa_mint_address) {
      try {
        const { createUmi } = await import("https://esm.sh/@metaplex-foundation/umi-bundle-defaults@0.9.2");
        const { mplCore, transferV1 } = await import("https://esm.sh/@metaplex-foundation/mpl-core@1.1.1");
        const { createSignerFromKeypair, keypairIdentity, publicKey } = await import("https://esm.sh/@metaplex-foundation/umi@0.9.2");
        const bs58Module = await import("https://esm.sh/bs58@6.0.0");
        const bs58 = bs58Module.default || bs58Module;

        const umi = createUmi(rpcUrl).use(mplCore());
        const secretKeyBytes = bs58.decode(treasuryPrivateKey);
        const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKeyBytes);
        const signer = createSignerFromKeypair(umi, umiKeypair);
        umi.use(keypairIdentity(signer));

        const transferTx = await transferV1(umi, {
          asset: publicKey(nfaMint.nfa_mint_address),
          newOwner: publicKey(buyerWallet),
          ...(nfaCollectionAddress ? { collection: publicKey(nfaCollectionAddress) } : {}),
        }).sendAndConfirm(umi);

        nftTransferSig = transferTx.signature ? Buffer.from(transferTx.signature).toString("base64") : null;
      } catch (e) {
        console.error("NFT transfer failed (continuing with DB update):", e);
      }
    }

    // Update listing
    await supabase
      .from("nfa_listings")
      .update({
        status: "sold",
        buyer_wallet: buyerWallet,
        sale_signature: paymentSignature,
        sold_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    // Transfer ownership in DB
    await supabase
      .from("nfa_mints")
      .update({
        owner_wallet: buyerWallet,
        listed_for_sale: false,
        listing_price_sol: null,
      })
      .eq("id", listing.nfa_mint_id);

    return new Response(
      JSON.stringify({ success: true, nftTransferSig }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("NFA buy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
