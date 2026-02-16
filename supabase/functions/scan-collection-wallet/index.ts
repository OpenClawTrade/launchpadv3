import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COLLECTION_WALLET = "9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe";
const OLD_TUNA_MINT = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";
const TOKEN_DECIMALS = 6;

interface HeliusTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
}

interface HeliusTransaction {
  signature: string;
  timestamp: number;
  tokenTransfers: HeliusTransfer[];
  type: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    if (!heliusApiKey) {
      throw new Error("HELIUS_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL transactions for the collection wallet using Helius Enhanced Transaction History
    // Paginate through all results
    const allTransactions: HeliusTransaction[] = [];
    let lastSignature: string | undefined;
    let page = 0;
    const MAX_PAGES = 100; // Safety limit

    console.log(`Starting scan of collection wallet: ${COLLECTION_WALLET}`);

    while (page < MAX_PAGES) {
      const url = new URL(
        `https://api.helius.xyz/v0/addresses/${COLLECTION_WALLET}/transactions`
      );
      url.searchParams.set("api-key", heliusApiKey);
      url.searchParams.set("limit", "100");
      if (lastSignature) {
        url.searchParams.set("before", lastSignature);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Helius API error (${res.status}): ${text}`);
      }

      const transactions: HeliusTransaction[] = await res.json();
      if (!transactions || transactions.length === 0) break;

      allTransactions.push(...transactions);
      lastSignature = transactions[transactions.length - 1].signature;
      page++;

      console.log(
        `Page ${page}: fetched ${transactions.length} txs (total: ${allTransactions.length})`
      );

      // Small delay to avoid rate limiting
      if (transactions.length === 100) {
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break; // Less than 100 means we got everything
      }
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`);

    // Filter and aggregate: only old TUNA mint transfers TO the collection wallet
    const walletMap = new Map<
      string,
      {
        totalTokens: number;
        txCount: number;
        firstTransferAt: number;
        lastTransferAt: number;
      }
    >();

    for (const tx of allTransactions) {
      if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) continue;

      for (const transfer of tx.tokenTransfers) {
        if (
          transfer.mint === OLD_TUNA_MINT &&
          transfer.toUserAccount === COLLECTION_WALLET &&
          transfer.fromUserAccount &&
          transfer.fromUserAccount !== COLLECTION_WALLET &&
          transfer.tokenAmount > 0
        ) {
          const sender = transfer.fromUserAccount;
          const existing = walletMap.get(sender);

          if (existing) {
            existing.totalTokens += transfer.tokenAmount;
            existing.txCount += 1;
            existing.firstTransferAt = Math.min(
              existing.firstTransferAt,
              tx.timestamp
            );
            existing.lastTransferAt = Math.max(
              existing.lastTransferAt,
              tx.timestamp
            );
          } else {
            walletMap.set(sender, {
              totalTokens: transfer.tokenAmount,
              txCount: 1,
              firstTransferAt: tx.timestamp,
              lastTransferAt: tx.timestamp,
            });
          }
        }
      }
    }

    console.log(`Found ${walletMap.size} unique senders`);

    // Upsert into tuna_migration_ledger
    const now = new Date().toISOString();
    const upsertRows = Array.from(walletMap.entries()).map(
      ([wallet, data]) => ({
        wallet_address: wallet,
        total_tokens_received: data.totalTokens,
        tx_count: data.txCount,
        first_transfer_at: new Date(data.firstTransferAt * 1000).toISOString(),
        last_transfer_at: new Date(data.lastTransferAt * 1000).toISOString(),
        last_scanned_at: now,
      })
    );

    if (upsertRows.length > 0) {
      // Batch upsert in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
        const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from("tuna_migration_ledger")
          .upsert(chunk, { onConflict: "wallet_address" });

        if (error) {
          console.error(`Upsert error for chunk ${i}:`, error);
          throw new Error(`Database upsert failed: ${error.message}`);
        }
      }
    }

    // Calculate summary stats
    let totalTokens = 0;
    let totalTxs = 0;
    for (const data of walletMap.values()) {
      totalTokens += data.totalTokens;
      totalTxs += data.txCount;
    }

    const summary = {
      success: true,
      total_tokens_received: totalTokens,
      unique_senders: walletMap.size,
      total_transactions: totalTxs,
      pages_fetched: page,
      raw_transactions_scanned: allTransactions.length,
      scanned_at: now,
    };

    console.log("Scan complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Scan error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
