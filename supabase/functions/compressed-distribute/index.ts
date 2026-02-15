import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      sourcePrivateKey,
      mintAddress,
      destinations,
      amountPerWallet,
      action, // "distribute" | "check-pool" | "compress"
    } = await req.json();

    const HELIUS_RPC_URL = Deno.env.get("HELIUS_RPC_URL");
    if (!HELIUS_RPC_URL) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Dynamic imports via esm.sh
    const { Keypair, PublicKey, LAMPORTS_PER_SOL } = await import(
      "https://esm.sh/@solana/web3.js@1.98.0"
    );
    const { getAssociatedTokenAddress, getAccount, getMint } = await import(
      "https://esm.sh/@solana/spl-token@0.4.9"
    );
    const bs58 = (await import("https://esm.sh/bs58@6.0.0")).default;
    const { createRpc, confirmTx } = await import(
      "https://esm.sh/@lightprotocol/stateless.js@0.17.1"
    );
    const { createTokenPool, compress, transfer } = await import(
      "https://esm.sh/@lightprotocol/compressed-token@0.17.1"
    );

    // Decode source keypair
    const sourceKeypairBytes = bs58.decode(sourcePrivateKey);
    const sourceKeypair = Keypair.fromSecretKey(sourceKeypairBytes);
    const sourcePubkey = sourceKeypair.publicKey;

    // Create RPC connection with ZK Compression support
    // Helius RPC supports compression natively, so we use it for all three endpoints
    const connection = createRpc(HELIUS_RPC_URL, HELIUS_RPC_URL, HELIUS_RPC_URL);

    const mint = new PublicKey(mintAddress);

    // Get mint info for decimals
    const mintInfo = await getMint(connection, mint);
    const decimals = mintInfo.decimals;
    const rawAmount = Math.round(amountPerWallet * Math.pow(10, decimals));

    // Record starting SOL balance
    const startBalance = await connection.getBalance(sourcePubkey);
    const logs: string[] = [];
    const signatures: string[] = [];

    logs.push(`Source wallet: ${sourcePubkey.toBase58()}`);
    logs.push(`Mint: ${mintAddress} (${decimals} decimals)`);
    logs.push(`Starting SOL balance: ${(startBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    logs.push(`Amount per wallet: ${amountPerWallet} (raw: ${rawAmount})`);
    logs.push(`Destinations: ${destinations.length}`);

    if (action === "check-pool") {
      // Just check if token pool exists and return info
      logs.push("Checking token pool status...");
      
      try {
        // Try to create token pool - if it already exists, it will throw
        const poolTxId = await createTokenPool(connection, sourceKeypair, mint);
        await confirmTx(connection, poolTxId);
        logs.push(`Token pool created! Tx: ${poolTxId}`);
        signatures.push(poolTxId);
      } catch (e: any) {
        if (e.message?.includes("already") || e.message?.includes("exist")) {
          logs.push("Token pool already exists ✓");
        } else {
          logs.push(`Token pool check error: ${e.message}`);
          throw e;
        }
      }

      const endBalance = await connection.getBalance(sourcePubkey);
      const costSol = (startBalance - endBalance) / LAMPORTS_PER_SOL;

      return new Response(
        JSON.stringify({
          success: true,
          action: "check-pool",
          logs,
          signatures,
          costSol,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "compress") {
      // Compress SPL tokens from ATA into compressed token account
      logs.push("Compressing SPL tokens...");

      const ata = await getAssociatedTokenAddress(mint, sourcePubkey);
      let ataBalance: bigint;
      try {
        const ataAccount = await getAccount(connection, ata);
        ataBalance = ataAccount.amount;
        logs.push(`ATA balance: ${Number(ataBalance)} raw tokens`);
      } catch {
        throw new Error("No ATA found for this mint. Source wallet doesn't hold this token.");
      }

      const totalNeeded = BigInt(rawAmount) * BigInt(destinations.length);
      const compressAmount = totalNeeded > ataBalance ? ataBalance : totalNeeded;

      logs.push(`Compressing ${Number(compressAmount)} raw tokens...`);

      const compressTxId = await compress(
        connection,
        sourceKeypair,
        mint,
        compressAmount,
        sourceKeypair,
        ata
      );
      await confirmTx(connection, compressTxId);
      logs.push(`Compressed! Tx: ${compressTxId}`);
      signatures.push(compressTxId);

      const endBalance = await connection.getBalance(sourcePubkey);
      const costSol = (startBalance - endBalance) / LAMPORTS_PER_SOL;

      return new Response(
        JSON.stringify({
          success: true,
          action: "compress",
          logs,
          signatures,
          costSol,
          compressedAmount: Number(compressAmount),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // action === "distribute" (default)
    // Batch transfer compressed tokens to destinations
    const BATCH_SIZE = 1; // compressed transfers are 1-per-tx currently
    const results: { destination: string; status: string; signature?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      logs.push(`[${i + 1}/${destinations.length}] Transferring to ${dest.slice(0, 8)}...`);

      try {
        const destPubkey = new PublicKey(dest);

        const txId = await transfer(
          connection,
          sourceKeypair,
          mint,
          rawAmount,
          sourceKeypair, // owner
          destPubkey
        );
        await confirmTx(connection, txId);

        logs.push(`  ✓ Success: ${txId}`);
        signatures.push(txId);
        results.push({ destination: dest, status: "success", signature: txId });
        successCount++;
      } catch (e: any) {
        logs.push(`  ✗ Failed: ${e.message}`);
        results.push({ destination: dest, status: "failed", error: e.message });
        failCount++;
      }
    }

    // Record ending SOL balance
    const endBalance = await connection.getBalance(sourcePubkey);
    const totalCostSol = (startBalance - endBalance) / LAMPORTS_PER_SOL;
    const costPerWallet = destinations.length > 0 ? totalCostSol / destinations.length : 0;

    logs.push(`\nDistribution complete!`);
    logs.push(`Success: ${successCount}, Failed: ${failCount}`);
    logs.push(`Total SOL cost: ${totalCostSol.toFixed(6)} SOL`);
    logs.push(`Cost per wallet: ${costPerWallet.toFixed(6)} SOL`);
    logs.push(`Ending SOL balance: ${(endBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

    return new Response(
      JSON.stringify({
        success: true,
        action: "distribute",
        logs,
        signatures,
        results,
        stats: {
          total: destinations.length,
          success: successCount,
          failed: failCount,
          totalCostSol,
          costPerWallet,
          startBalance: startBalance / LAMPORTS_PER_SOL,
          endBalance: endBalance / LAMPORTS_PER_SOL,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("compressed-distribute error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error", success: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
