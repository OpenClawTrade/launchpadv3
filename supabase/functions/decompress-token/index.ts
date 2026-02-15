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
    const { walletAddress, mintAddress, action } = await req.json();

    const HELIUS_RPC_URL = Deno.env.get("HELIUS_RPC_URL");
    if (!HELIUS_RPC_URL) throw new Error("HELIUS_RPC_URL not configured");
    if (!walletAddress) throw new Error("walletAddress required");

    const { PublicKey } = await import("https://esm.sh/@solana/web3.js@1.98.0");
    const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint } = await import(
      "https://esm.sh/@solana/spl-token@0.4.9"
    );
    const { createRpc } = await import(
      "https://esm.sh/@lightprotocol/stateless.js@0.21.0?no-dts&target=es2022&deps=@solana/web3.js@1.98.0"
    );

    const connection = createRpc(HELIUS_RPC_URL, HELIUS_RPC_URL, HELIUS_RPC_URL);
    const ownerPubkey = new PublicKey(walletAddress);

    if (action === "check-balances") {
      // Query compressed token accounts
      const compressedAccounts = await connection.getCompressedTokenAccountsByOwner(ownerPubkey);
      const items = compressedAccounts.items || compressedAccounts || [];

      // Group by mint
      const balancesByMint: Record<string, { balance: string; accounts: number }> = {};
      for (const account of items) {
        const parsed = account.parsed || account;
        const mint = parsed.mint?.toBase58?.() || String(parsed.mint);
        const amount = parsed.amount?.toString?.() || String(parsed.amount || "0");

        if (!balancesByMint[mint]) {
          balancesByMint[mint] = { balance: "0", accounts: 0 };
        }
        balancesByMint[mint].balance = (BigInt(balancesByMint[mint].balance) + BigInt(amount)).toString();
        balancesByMint[mint].accounts++;
      }

      // Get decimals for each mint
      const results = [];
      for (const [mint, data] of Object.entries(balancesByMint)) {
        if (BigInt(data.balance) === BigInt(0)) continue;

        let decimals = 9;
        let tokenProgram = "spl";
        try {
          const mintPubkey = new PublicKey(mint);
          try {
            const info = await getMint(connection, mintPubkey, undefined, TOKEN_PROGRAM_ID);
            decimals = info.decimals;
          } catch {
            try {
              const info = await getMint(connection, mintPubkey, undefined, TOKEN_2022_PROGRAM_ID);
              decimals = info.decimals;
              tokenProgram = "token-2022";
            } catch { /* default */ }
          }
        } catch { /* default */ }

        results.push({
          mint,
          rawBalance: data.balance,
          balance: Number(BigInt(data.balance)) / Math.pow(10, decimals),
          decimals,
          accounts: data.accounts,
          tokenProgram,
        });
      }

      const filtered = mintAddress ? results.filter(r => r.mint === mintAddress) : results;

      return new Response(
        JSON.stringify({ success: true, balances: filtered }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "decompress") {
      if (!mintAddress) throw new Error("mintAddress required");

      const bs58 = (await import("https://esm.sh/bs58@6.0.0")).default;
      const { Keypair } = await import("https://esm.sh/@solana/web3.js@1.98.0");
      const { getAssociatedTokenAddress } = await import("https://esm.sh/@solana/spl-token@0.4.9");
      const { decompress, confirmTx } = await import(
        "https://esm.sh/@lightprotocol/compressed-token@0.21.0?no-dts&target=es2022&deps=@solana/web3.js@1.98.0"
      );

      // For server-side decompress, we need a fee payer
      const TREASURY_PRIVATE_KEY = Deno.env.get("TREASURY_PRIVATE_KEY");
      if (!TREASURY_PRIVATE_KEY) throw new Error("Treasury not configured");

      const payer = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
      const mint = new PublicKey(mintAddress);

      // Determine token program
      let tokenProgramId = TOKEN_PROGRAM_ID;
      try {
        await getMint(connection, mint, undefined, TOKEN_PROGRAM_ID);
      } catch {
        await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
        tokenProgramId = TOKEN_2022_PROGRAM_ID;
      }

      // Get compressed balance
      const compressedAccounts = await connection.getCompressedTokenAccountsByOwner(ownerPubkey, { mint });
      const items = compressedAccounts.items || compressedAccounts || [];
      if (!items.length) throw new Error("No compressed tokens found");

      let totalBalance = BigInt(0);
      for (const account of items) {
        const parsed = account.parsed || account;
        totalBalance += BigInt(parsed.amount?.toString?.() || "0");
      }
      if (totalBalance === BigInt(0)) throw new Error("Zero balance");

      const ata = await getAssociatedTokenAddress(mint, ownerPubkey, false, tokenProgramId);

      // Execute decompress - treasury pays gas, tokens go to user's ATA
      // Note: decompress() requires the owner to be a Keypair (signer).
      // Since the user can't sign server-side, we check if the treasury IS the owner
      // or if we need a different approach.
      //
      // For the case where tokens were distributed TO the user's wallet via compressed transfer,
      // the OWNER of those compressed tokens is the user's wallet.
      // decompress() needs the owner's signature. We can't do this server-side without the user's key.
      //
      // The only way: return balance data and have frontend do it.

      return new Response(
        JSON.stringify({
          success: true,
          action: "decompress-info",
          data: {
            mint: mintAddress,
            rawBalance: totalBalance.toString(),
            ata: ata.toBase58(),
            tokenProgram: tokenProgramId.equals(TOKEN_2022_PROGRAM_ID) ? "token-2022" : "spl",
            accounts: items.length,
            rpcUrl: HELIUS_RPC_URL, // Frontend needs this for Light Protocol SDK
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    console.error("decompress-token error:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err), success: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
