import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WALLET_ADDRESS = "EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const ADMIN_PASSWORD = "saturn135@";
const PUMPPORTAL_API = "https://pumpportal.fun/api/trade-local";
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { adminPassword, slippage = 2500, dryRun = false } = await req.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateKeyBase58 = Deno.env.get("BULK_SELL_PRIVATE_KEY");
    if (!privateKeyBase58) {
      return new Response(JSON.stringify({ error: "BULK_SELL_PRIVATE_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("ALCHEMY_SOLANA_RPC_URL");
    if (!rpcUrl) {
      return new Response(JSON.stringify({ error: "No RPC URL configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Import web3.js
    const { Keypair, VersionedTransaction, Connection } = await import("https://esm.sh/@solana/web3.js@1.98.0");
    const bs58 = (await import("https://esm.sh/bs58@5.0.0")).default;

    const secretKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection(rpcUrl, "confirmed");

    console.log(`[bulk-sell] Wallet: ${keypair.publicKey.toBase58()}`);
    if (keypair.publicKey.toBase58() !== WALLET_ADDRESS) {
      return new Response(JSON.stringify({ error: "Private key does not match expected wallet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { programId: (await import("https://esm.sh/@solana/web3.js@1.98.0")).TOKEN_PROGRAM_ID }
    );

    // Also fetch Token-2022 accounts
    let token2022Accounts: any[] = [];
    try {
      const t22Result = await connection.getParsedTokenAccountsByOwner(
        keypair.publicKey,
        { programId: new (await import("https://esm.sh/@solana/web3.js@1.98.0")).PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") }
      );
      token2022Accounts = t22Result.value || [];
    } catch (e) {
      console.log("[bulk-sell] No Token-2022 accounts or error:", e.message);
    }

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts];

    const holdings = allAccounts
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint as string,
          balance: parseFloat(info.tokenAmount.uiAmountString || "0"),
          rawAmount: info.tokenAmount.amount as string,
          decimals: info.tokenAmount.decimals as number,
        };
      })
      .filter((h) => h.mint !== WSOL_MINT && h.balance > 0);

    console.log(`[bulk-sell] Found ${holdings.length} tokens with balance`);

    if (dryRun) {
      return new Response(JSON.stringify({
        walletAddress: WALLET_ADDRESS,
        totalTokens: holdings.length,
        holdings,
        dryRun: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sell each token
    const results: any[] = [];

    for (const holding of holdings) {
      console.log(`[bulk-sell] Selling ${holding.mint} (balance: ${holding.balance})`);

      try {
        // Try PumpPortal first
        let sold = false;
        try {
          const ppResponse = await fetch(PUMPPORTAL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicKey: WALLET_ADDRESS,
              action: "sell",
              mint: holding.mint,
              amount: holding.rawAmount,
              denominatedInSol: "false",
              slippage: Math.floor(slippage / 100), // PumpPortal uses percentage
              priorityFee: 0.001,
              pool: "auto",
            }),
          });

          if (ppResponse.ok) {
            const contentType = ppResponse.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const ppData = await ppResponse.json();
              if (ppData.error || ppData.statusCode >= 400) {
                console.log(`[bulk-sell] PumpPortal error for ${holding.mint}:`, ppData.error || ppData.message);
              } else {
                console.log(`[bulk-sell] PumpPortal returned JSON for ${holding.mint}, unexpected`);
              }
            } else {
              // Binary tx data
              const txBytes = new Uint8Array(await ppResponse.arrayBuffer());
              const tx = VersionedTransaction.deserialize(txBytes);
              tx.sign([keypair]);
              const sig = await connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
                maxRetries: 3,
              });
              console.log(`[bulk-sell] PumpPortal sell OK: ${sig}`);
              results.push({ mint: holding.mint, balance: holding.balance, status: "sold", via: "pumpportal", signature: sig });
              sold = true;
            }
          } else {
            const errText = await ppResponse.text();
            console.log(`[bulk-sell] PumpPortal failed (${ppResponse.status}) for ${holding.mint}: ${errText.slice(0, 200)}`);
          }
        } catch (ppErr) {
          console.log(`[bulk-sell] PumpPortal exception for ${holding.mint}:`, ppErr.message);
        }

        // Jupiter fallback
        if (!sold) {
          try {
            const jupApiKey = Deno.env.get("JUPITER_API_KEY") || "";
            const jupHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (jupApiKey) jupHeaders["x-api-key"] = jupApiKey;

            const quoteUrl = `${JUPITER_SWAP_API}/quote?inputMint=${holding.mint}&outputMint=${WSOL_MINT}&amount=${holding.rawAmount}&slippageBps=${slippage}`;
            const quoteResp = await fetch(quoteUrl, { headers: jupHeaders });

            if (!quoteResp.ok) {
              const errData = await quoteResp.text();
              console.log(`[bulk-sell] Jupiter quote failed for ${holding.mint}: ${errData.slice(0, 200)}`);
              results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: "No route (pump or jupiter)" });
              continue;
            }

            const quote = await quoteResp.json();
            const swapResp = await fetch(`${JUPITER_SWAP_API}/swap`, {
              method: "POST",
              headers: jupHeaders,
              body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: WALLET_ADDRESS,
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: "auto",
              }),
            });

            if (!swapResp.ok) {
              const errData = await swapResp.text();
              console.log(`[bulk-sell] Jupiter swap failed for ${holding.mint}: ${errData.slice(0, 200)}`);
              results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: "Jupiter swap failed" });
              continue;
            }

            const swapData = await swapResp.json();
            const txBytes = Uint8Array.from(atob(swapData.swapTransaction), (c) => c.charCodeAt(0));
            const tx = VersionedTransaction.deserialize(txBytes);
            tx.sign([keypair]);
            const sig = await connection.sendRawTransaction(tx.serialize(), {
              skipPreflight: true,
              maxRetries: 3,
            });
            console.log(`[bulk-sell] Jupiter sell OK: ${sig}`);
            results.push({ mint: holding.mint, balance: holding.balance, status: "sold", via: "jupiter", signature: sig });
          } catch (jupErr) {
            console.log(`[bulk-sell] Jupiter exception for ${holding.mint}:`, jupErr.message);
            results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: jupErr.message });
          }
        }
      } catch (err) {
        console.error(`[bulk-sell] Error selling ${holding.mint}:`, err);
        results.push({ mint: holding.mint, balance: holding.balance, status: "error", error: err.message });
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 2000));
    }

    const sold = results.filter((r) => r.status === "sold").length;
    const failed = results.filter((r) => r.status !== "sold").length;

    return new Response(JSON.stringify({
      walletAddress: WALLET_ADDRESS,
      totalTokens: holdings.length,
      sold,
      failed,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[bulk-sell] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
