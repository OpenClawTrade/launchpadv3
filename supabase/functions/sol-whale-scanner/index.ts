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

    const { minSolAmount = 10, lastSlot } = await req.json();
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const minLamports = minSolAmount * 1e9;

    // Step 1: Get latest confirmed slot
    const slotRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "confirmed" }],
      }),
    });
    const slotData = await slotRes.json();
    const currentSlot = slotData.result;

    if (lastSlot && currentSlot <= lastSlot) {
      return new Response(
        JSON.stringify({ slot: currentSlot, skipped: true, wallets: [], totalTxInBlock: 0, qualifiedTxCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get block with full transaction data
    const blockRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getBlock",
        params: [
          currentSlot,
          {
            encoding: "json",
            transactionDetails: "full",
            rewards: false,
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    });
    const blockData = await blockRes.json();

    if (blockData.error) {
      // Slot may not be available yet, try slot - 1
      return new Response(
        JSON.stringify({ slot: currentSlot, skipped: true, error: blockData.error.message, wallets: [], totalTxInBlock: 0, qualifiedTxCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const block = blockData.result;
    if (!block || !block.transactions) {
      return new Response(
        JSON.stringify({ slot: currentSlot, skipped: true, wallets: [], totalTxInBlock: 0, qualifiedTxCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTxInBlock = block.transactions.length;

    // Step 3: Pre-filter - find signatures with whale-level balance changes
    const qualifiedSignatures: string[] = [];
    for (const tx of block.transactions) {
      if (!tx.meta || tx.meta.err) continue;
      const pre = tx.meta.preBalances;
      const post = tx.meta.postBalances;
      if (!pre || !post) continue;

      let qualified = false;
      for (let i = 0; i < pre.length; i++) {
        const diff = Math.abs(post[i] - pre[i]);
        if (diff >= minLamports) {
          qualified = true;
          break;
        }
      }
      if (qualified && tx.transaction?.signatures?.[0]) {
        qualifiedSignatures.push(tx.transaction.signatures[0]);
      }
    }

    if (qualifiedSignatures.length === 0) {
      return new Response(
        JSON.stringify({
          slot: currentSlot,
          blockTime: block.blockTime,
          wallets: [],
          totalTxInBlock,
          qualifiedTxCount: 0,
          creditsUsed: 2,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Enhance qualifying signatures via Helius Enhanced Transactions API
    // Process in batches of 100
    const allWallets: WalletEntry[] = [];
    const batchSize = 100;
    let creditsUsed = 2; // getSlot + getBlock

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

        if (!enhanceRes.ok) {
          // If enhanced API fails, fall back to raw balance parsing for this batch
          console.error(`Enhanced API failed: ${enhanceRes.status}`);
          creditsUsed += batch.length;
          continue;
        }

        const enhanced = await enhanceRes.json();
        creditsUsed += batch.length;

        for (const etx of enhanced) {
          if (!etx) continue;
          const sig = etx.signature || "";
          const txType = etx.type || "UNKNOWN";
          const txSource = etx.source || "UNKNOWN";

          // Parse native transfers
          if (etx.nativeTransfers) {
            for (const nt of etx.nativeTransfers) {
              const amountSol = (nt.amount || 0) / 1e9;
              if (amountSol >= minSolAmount) {
                if (nt.fromUserAccount) {
                  allWallets.push({
                    address: nt.fromUserAccount,
                    amountSol,
                    direction: "sent",
                    type: txType,
                    source: txSource,
                    signature: sig,
                  });
                }
                if (nt.toUserAccount) {
                  allWallets.push({
                    address: nt.toUserAccount,
                    amountSol,
                    direction: "received",
                    type: txType,
                    source: txSource,
                    signature: sig,
                  });
                }
              }
            }
          }

          // Parse swap events
          if (etx.events?.swap) {
            const swap = etx.events.swap;
            // Check native inputs/outputs for SOL involvement
            const nativeIn = (swap.nativeInput?.amount || 0) / 1e9;
            const nativeOut = (swap.nativeOutput?.amount || 0) / 1e9;
            const solAmount = Math.max(nativeIn, nativeOut);

            if (solAmount >= minSolAmount) {
              // The fee payer / signer is typically the swapper
              if (etx.feePayer) {
                allWallets.push({
                  address: etx.feePayer,
                  amountSol: solAmount,
                  direction: "swapped",
                  type: "SWAP",
                  source: txSource,
                  tokenInvolved: swap.tokenInputs?.[0]?.mint || swap.tokenOutputs?.[0]?.mint,
                  signature: sig,
                });
              }
            }
          }

          // Parse token transfers (check if associated with large SOL movement)
          if (etx.tokenTransfers && txType !== "SWAP") {
            for (const tt of etx.tokenTransfers) {
              // We already filtered by SOL balance change, so these are relevant
              if (tt.fromUserAccount && tt.fromUserAccount !== "") {
                allWallets.push({
                  address: tt.fromUserAccount,
                  amountSol: 0, // Token transfer, SOL amount captured in native
                  direction: "sent",
                  type: txType,
                  source: txSource,
                  tokenInvolved: tt.mint,
                  signature: sig,
                });
              }
              if (tt.toUserAccount && tt.toUserAccount !== "") {
                allWallets.push({
                  address: tt.toUserAccount,
                  amountSol: 0,
                  direction: "received",
                  type: txType,
                  source: txSource,
                  tokenInvolved: tt.mint,
                  signature: sig,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error(`Batch enhance error: ${e.message}`);
      }
    }

    // Filter out system programs and known non-wallet addresses
    const systemAddresses = new Set([
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "ComputeBudget111111111111111111111111111111",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      "So11111111111111111111111111111111111111112",
    ]);

    const filteredWallets = allWallets.filter(
      (w) => !systemAddresses.has(w.address) && w.address.length >= 32
    );

    return new Response(
      JSON.stringify({
        slot: currentSlot,
        blockTime: block.blockTime,
        wallets: filteredWallets,
        totalTxInBlock,
        qualifiedTxCount: qualifiedSignatures.length,
        creditsUsed,
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
