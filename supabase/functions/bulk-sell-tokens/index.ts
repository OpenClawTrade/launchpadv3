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
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// Minimal base58 decoder
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeBase58(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const c of str) {
    const idx = BASE58_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error("Invalid base58 char");
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const c of str) {
    if (c !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

async function rpcCall(rpcUrl: string, method: string, params: any[]) {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { adminPassword, slippage = 2500, dryRun = false } = await req.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateKeyBase58 = Deno.env.get("BULK_SELL_PRIVATE_KEY");
    if (!privateKeyBase58 && !dryRun) {
      return new Response(JSON.stringify({ error: "BULK_SELL_PRIVATE_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("ALCHEMY_SOLANA_RPC_URL");
    if (!rpcUrl) {
      return new Response(JSON.stringify({ error: "No RPC URL configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch token accounts via RPC (no web3.js import needed for scan)
    const fetchAccounts = async (programId: string) => {
      try {
        const result = await rpcCall(rpcUrl, "getTokenAccountsByOwner", [
          WALLET_ADDRESS,
          { programId },
          { encoding: "jsonParsed" },
        ]);
        return result?.value || [];
      } catch {
        return [];
      }
    };

    const [splAccounts, t22Accounts] = await Promise.all([
      fetchAccounts(TOKEN_PROGRAM),
      fetchAccounts(TOKEN_2022_PROGRAM),
    ]);

    const allAccounts = [...splAccounts, ...t22Accounts];

    const holdings = allAccounts
      .map((acc: any) => {
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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For selling, we need web3.js to sign transactions — lazy import
    const { Keypair, VersionedTransaction, Connection } = await import("npm:@solana/web3.js@1.98.0");

    const secretKey = decodeBase58(privateKeyBase58!);
    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection(rpcUrl, "confirmed");

    if (keypair.publicKey.toBase58() !== WALLET_ADDRESS) {
      return new Response(JSON.stringify({ error: "Private key does not match expected wallet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const holding of holdings) {
      console.log(`[bulk-sell] Selling ${holding.mint} (${holding.balance})`);

      try {
        let sold = false;

        // Try PumpPortal
        try {
          const ppResp = await fetch(PUMPPORTAL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicKey: WALLET_ADDRESS,
              action: "sell",
              mint: holding.mint,
              amount: holding.rawAmount,
              denominatedInSol: "false",
              slippage: Math.floor(slippage / 100),
              priorityFee: 0.001,
              pool: "auto",
            }),
          });

          if (ppResp.ok) {
            const ct = ppResp.headers.get("content-type") || "";
            if (!ct.includes("application/json")) {
              const txBytes = new Uint8Array(await ppResp.arrayBuffer());
              const tx = VersionedTransaction.deserialize(txBytes);
              tx.sign([keypair]);
              const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
              results.push({ mint: holding.mint, balance: holding.balance, status: "sold", via: "pumpportal", signature: sig });
              sold = true;
            }
          }
        } catch (e) {
          console.log(`[bulk-sell] PP error ${holding.mint}: ${e.message}`);
        }

        // Jupiter fallback
        if (!sold) {
          try {
            const jupKey = Deno.env.get("JUPITER_API_KEY") || "";
            const jh: Record<string, string> = { "Content-Type": "application/json" };
            if (jupKey) jh["x-api-key"] = jupKey;

            const qResp = await fetch(`${JUPITER_SWAP_API}/quote?inputMint=${holding.mint}&outputMint=${WSOL_MINT}&amount=${holding.rawAmount}&slippageBps=${slippage}`, { headers: jh });
            if (!qResp.ok) {
              results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: "No route" });
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }

            const quote = await qResp.json();
            const sResp = await fetch(`${JUPITER_SWAP_API}/swap`, {
              method: "POST", headers: jh,
              body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: WALLET_ADDRESS,
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: "auto",
              }),
            });

            if (!sResp.ok) {
              results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: "Jupiter swap failed" });
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }

            const swapData = await sResp.json();
            const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
            const tx = VersionedTransaction.deserialize(txBytes);
            tx.sign([keypair]);
            const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
            results.push({ mint: holding.mint, balance: holding.balance, status: "sold", via: "jupiter", signature: sig });
          } catch (e) {
            results.push({ mint: holding.mint, balance: holding.balance, status: "failed", error: e.message });
          }
        }
      } catch (err) {
        results.push({ mint: holding.mint, balance: holding.balance, status: "error", error: err.message });
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(JSON.stringify({
      walletAddress: WALLET_ADDRESS,
      totalTokens: holdings.length,
      sold: results.filter(r => r.status === "sold").length,
      failed: results.filter(r => r.status !== "sold").length,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[bulk-sell] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
