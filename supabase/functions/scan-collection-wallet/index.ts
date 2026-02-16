import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COLLECTION_WALLET = "9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe";
const OLD_TUNA_MINT = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";

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

    const heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

    console.log(`Starting scan of collection wallet: ${COLLECTION_WALLET}`);
    console.log(`Looking for mint: ${OLD_TUNA_MINT}`);

    // Step 1: Find the TUNA token account (ATA) for the collection wallet
    const ataRes = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-ata",
        method: "getTokenAccountsByOwner",
        params: [
          COLLECTION_WALLET,
          { mint: OLD_TUNA_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const ataData = await ataRes.json();
    if (ataData.error) {
      throw new Error(`RPC error finding ATA: ${JSON.stringify(ataData.error)}`);
    }

    const tokenAccounts = ataData.result?.value || [];
    if (tokenAccounts.length === 0) {
      throw new Error("No TUNA token account found for collection wallet");
    }

    const ataAddress = tokenAccounts[0].pubkey;
    console.log(`Found TUNA ATA: ${ataAddress}`);

    // Step 2: Get ALL signatures for the ATA address
    const allSignatures: { signature: string; blockTime: number }[] = [];
    let beforeSig: string | undefined;
    let sigPage = 0;

    while (sigPage < 200) {
      const params: any[] = [ataAddress, { limit: 1000 }];
      if (beforeSig) {
        params[1].before = beforeSig;
      }

      const rpcRes = await fetch(heliusRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `sigs-${sigPage}`,
          method: "getSignaturesForAddress",
          params,
        }),
      });

      const rpcData = await rpcRes.json();
      if (rpcData.error) {
        throw new Error(`RPC error: ${JSON.stringify(rpcData.error)}`);
      }

      const sigs = rpcData.result || [];
      if (sigs.length === 0) break;

      const successSigs = sigs
        .filter((s: any) => s.err === null)
        .map((s: any) => ({ signature: s.signature, blockTime: s.blockTime }));
      allSignatures.push(...successSigs);
      beforeSig = sigs[sigs.length - 1].signature;
      sigPage++;

      console.log(
        `Sig page ${sigPage}: fetched ${sigs.length} (success: ${successSigs.length}, total: ${allSignatures.length})`
      );

      if (sigs.length < 1000) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Total ATA signatures fetched: ${allSignatures.length}`);

    // Step 3: Parse transactions in batches using Helius
    const PARSE_BATCH_SIZE = 100;
    const walletMap = new Map<
      string,
      {
        totalTokens: number;
        txCount: number;
        firstTransferAt: number;
        lastTransferAt: number;
      }
    >();

    let totalParsed = 0;
    let matchCount = 0;

    for (let i = 0; i < allSignatures.length; i += PARSE_BATCH_SIZE) {
      const batch = allSignatures.slice(i, i + PARSE_BATCH_SIZE);
      const sigStrings = batch.map((s) => s.signature);

      const parseRes = await fetch(
        `https://api.helius.xyz/v0/transactions/?api-key=${heliusApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: sigStrings }),
        }
      );

      if (!parseRes.ok) {
        const text = await parseRes.text();
        console.error(`Parse API error (${parseRes.status}): ${text}`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const parsedTxs: HeliusTransaction[] = await parseRes.json();
      totalParsed += parsedTxs.length;

      for (const tx of parsedTxs) {
        if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) continue;

        for (const transfer of tx.tokenTransfers) {
          if (
            transfer.mint === OLD_TUNA_MINT &&
            transfer.toUserAccount === COLLECTION_WALLET &&
            transfer.fromUserAccount &&
            transfer.fromUserAccount !== COLLECTION_WALLET &&
            transfer.tokenAmount > 0
          ) {
            matchCount++;
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

      const batchNum = Math.floor(i / PARSE_BATCH_SIZE) + 1;
      console.log(
        `Parsed batch ${batchNum}/${Math.ceil(allSignatures.length / PARSE_BATCH_SIZE)}: matches=${matchCount}, senders=${walletMap.size}`
      );

      // Rate limit between batches
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`Total parsed: ${totalParsed}, Matches: ${matchCount}, Unique senders: ${walletMap.size}`);

    // Upsert into tuna_migration_ledger - first clear old data, then insert fresh
    const now = new Date().toISOString();
    
    // Delete all existing records (full refresh)
    await supabase.from("tuna_migration_ledger").delete().neq("id", "00000000-0000-0000-0000-000000000000");

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
      const CHUNK_SIZE = 500;
      for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
        const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from("tuna_migration_ledger")
          .insert(chunk);

        if (error) {
          console.error(`Insert error for chunk ${i}:`, error);
          throw new Error(`Database insert failed: ${error.message}`);
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
      ata_address: ataAddress,
      total_ata_signatures: allSignatures.length,
      total_parsed: totalParsed,
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
