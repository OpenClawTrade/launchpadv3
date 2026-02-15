import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WalletEntry {
  address: string;
  amountSol: number;
  direction: string;
  type: string;
  source: string;
  tokenInvolved?: string;
  signature: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not configured");

    const { minSolAmount = 10, fromSlot, slotsPerCall = 5 } = await req.json();
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const minLamports = minSolAmount * 1e9;

    // Step 1: Get latest confirmed slot
    const slotRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getSlot",
        params: [{ commitment: "confirmed" }],
      }),
    });
    const slotData = await slotRes.json();
    const latestSlot = slotData.result;

    // Determine range of slots to scan
    let startSlot: number;
    if (fromSlot && fromSlot > 0) {
      startSlot = fromSlot + 1;
    } else {
      // First call - start from latest
      startSlot = latestSlot;
    }

    // Don't scan ahead of chain
    const endSlot = Math.min(startSlot + slotsPerCall - 1, latestSlot);
    if (startSlot > latestSlot) {
      return new Response(
        JSON.stringify({ 
          lastScannedSlot: fromSlot || latestSlot, 
          latestSlot,
          waiting: true, 
          wallets: [], 
          slotsProcessed: 0,
          totalTxProcessed: 0,
          qualifiedTxCount: 0,
          creditsUsed: 1,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allWallets: WalletEntry[] = [];
    let totalTxProcessed = 0;
    let totalQualified = 0;
    let creditsUsed = 1; // getSlot
    let lastSuccessSlot = fromSlot || startSlot - 1;
    let slotsProcessed = 0;

    // Process each slot sequentially
    for (let slot = startSlot; slot <= endSlot; slot++) {
      try {
        const blockRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: slot, method: "getBlock",
            params: [slot, {
              encoding: "json",
              transactionDetails: "full",
              rewards: false,
              maxSupportedTransactionVersion: 0,
            }],
          }),
        });
        creditsUsed++;
        const blockData = await blockRes.json();

        if (blockData.error) {
          // Slot might be skipped (no block produced) - this is normal on Solana
          lastSuccessSlot = slot;
          slotsProcessed++;
          continue;
        }

        const block = blockData.result;
        if (!block || !block.transactions) {
          lastSuccessSlot = slot;
          slotsProcessed++;
          continue;
        }

        totalTxProcessed += block.transactions.length;

        // Pre-filter: find signatures with whale-level balance changes
        const qualifiedSignatures: string[] = [];
        for (const tx of block.transactions) {
          if (!tx.meta || tx.meta.err) continue;
          const pre = tx.meta.preBalances;
          const post = tx.meta.postBalances;
          if (!pre || !post) continue;

          for (let i = 0; i < pre.length; i++) {
            if (Math.abs(post[i] - pre[i]) >= minLamports) {
              const sig = tx.transaction?.signatures?.[0];
              if (sig) qualifiedSignatures.push(sig);
              break;
            }
          }
        }

        totalQualified += qualifiedSignatures.length;

        // Enhance qualifying signatures via Helius Enhanced API
        if (qualifiedSignatures.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < qualifiedSignatures.length; i += batchSize) {
            const batch = qualifiedSignatures.slice(i, i + batchSize);
            try {
              const enhanceRes = await fetch(
                `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transactions: batch }),
                }
              );
              creditsUsed += batch.length;

              if (!enhanceRes.ok) continue;
              const enhanced = await enhanceRes.json();

              for (const etx of enhanced) {
                if (!etx) continue;
                const sig = etx.signature || "";
                const txType = etx.type || "UNKNOWN";
                const txSource = etx.source || "UNKNOWN";

                // Native transfers
                if (etx.nativeTransfers) {
                  for (const nt of etx.nativeTransfers) {
                    const amountSol = (nt.amount || 0) / 1e9;
                    if (amountSol >= minSolAmount) {
                      if (nt.fromUserAccount) {
                        allWallets.push({ address: nt.fromUserAccount, amountSol, direction: "sent", type: txType, source: txSource, signature: sig });
                      }
                      if (nt.toUserAccount) {
                        allWallets.push({ address: nt.toUserAccount, amountSol, direction: "received", type: txType, source: txSource, signature: sig });
                      }
                    }
                  }
                }

                // Swap events
                if (etx.events?.swap) {
                  const swap = etx.events.swap;
                  const nativeIn = (swap.nativeInput?.amount || 0) / 1e9;
                  const nativeOut = (swap.nativeOutput?.amount || 0) / 1e9;
                  const solAmount = Math.max(nativeIn, nativeOut);
                  if (solAmount >= minSolAmount && etx.feePayer) {
                    allWallets.push({
                      address: etx.feePayer, amountSol: solAmount, direction: "swapped",
                      type: "SWAP", source: txSource,
                      tokenInvolved: swap.tokenInputs?.[0]?.mint || swap.tokenOutputs?.[0]?.mint,
                      signature: sig,
                    });
                  }
                }

                // Token transfers (non-swap)
                if (etx.tokenTransfers && txType !== "SWAP") {
                  for (const tt of etx.tokenTransfers) {
                    if (tt.fromUserAccount) {
                      allWallets.push({ address: tt.fromUserAccount, amountSol: 0, direction: "sent", type: txType, source: txSource, tokenInvolved: tt.mint, signature: sig });
                    }
                    if (tt.toUserAccount) {
                      allWallets.push({ address: tt.toUserAccount, amountSol: 0, direction: "received", type: txType, source: txSource, tokenInvolved: tt.mint, signature: sig });
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`Batch enhance error: ${e.message}`);
            }
          }
        }

        lastSuccessSlot = slot;
        slotsProcessed++;
      } catch (e) {
        console.error(`Slot ${slot} error: ${e.message}`);
        lastSuccessSlot = slot; // Skip failed slots
        slotsProcessed++;
      }
    }

    // Filter system programs
    const systemAddresses = new Set([
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "ComputeBudget111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      "So11111111111111111111111111111111111111112",
      "Vote111111111111111111111111111111111111111",
      "Stake11111111111111111111111111111111111111",
      "SysvarRent111111111111111111111111111111111",
    ]);

    const filteredWallets = allWallets.filter(
      (w) => !systemAddresses.has(w.address) && w.address.length >= 32
    );

    return new Response(
      JSON.stringify({
        lastScannedSlot: lastSuccessSlot,
        latestSlot,
        wallets: filteredWallets,
        slotsProcessed,
        totalTxProcessed,
        qualifiedTxCount: totalQualified,
        creditsUsed,
        slotsBehind: latestSlot - lastSuccessSlot,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Whale scanner error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
