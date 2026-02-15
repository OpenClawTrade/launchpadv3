import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

interface WalletEntry {
  address: string;
  amountSol: number;
  direction: string;
  type: string;
  source: string;
  tokenInvolved?: string;
  signature: string;
}

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

async function scanSlots(
  rpcUrl: string,
  heliusKey: string,
  startSlot: number,
  endSlot: number,
  minLamports: number,
  minSolAmount: number
): Promise<{
  wallets: WalletEntry[];
  slotsProcessed: number;
  totalTxProcessed: number;
  qualifiedTxCount: number;
  creditsUsed: number;
  lastSuccessSlot: number;
}> {
  const allWallets: WalletEntry[] = [];
  let totalTxProcessed = 0;
  let totalQualified = 0;
  let creditsUsed = 0;
  let lastSuccessSlot = startSlot - 1;
  let slotsProcessed = 0;

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

      if (qualifiedSignatures.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < qualifiedSignatures.length; i += batchSize) {
          const batch = qualifiedSignatures.slice(i, i + batchSize);
          try {
            const enhanceRes = await fetch(
              `https://api.helius.xyz/v0/transactions?api-key=${heliusKey}`,
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
      lastSuccessSlot = slot;
      slotsProcessed++;
    }
  }

  const filteredWallets = allWallets.filter(
    (w) => !systemAddresses.has(w.address) && w.address.length >= 32
  );

  return { wallets: filteredWallets, slotsProcessed, totalTxProcessed, qualifiedTxCount: totalQualified, creditsUsed, lastSuccessSlot };
}

async function handleStart(body: any) {
  const db = getDb();
  const { minSol = 10, slotsPerCall = 5 } = body;

  // Create session
  const { data: session, error } = await db
    .from("whale_scan_sessions")
    .insert({
      status: "running",
      min_sol: minSol,
      slots_per_call: slotsPerCall,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);

  // Fire-and-forget self-call to start scanning
  const selfUrl = `${SUPABASE_URL}/functions/v1/sol-whale-scanner`;
  fetch(selfUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: "continue", sessionId: session.id }),
  }).catch(() => {});

  return { sessionId: session.id, status: "running" };
}

async function handleStop(body: any) {
  const db = getDb();
  const { sessionId } = body;
  if (!sessionId) throw new Error("sessionId required");

  await db
    .from("whale_scan_sessions")
    .update({ status: "stopped" })
    .eq("id", sessionId);

  return { status: "stopped" };
}

async function handleStatus(body: any) {
  const db = getDb();
  const { sessionId } = body;
  if (!sessionId) throw new Error("sessionId required");

  const { data: session } = await db
    .from("whale_scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");

  // Get address count and top addresses
  const { count } = await db
    .from("whale_addresses")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { data: topAddresses } = await db
    .from("whale_addresses")
    .select("*")
    .eq("session_id", sessionId)
    .order("total_volume_sol", { ascending: false })
    .limit(1000);

  return {
    session: {
      id: session.id,
      status: session.status,
      minSol: session.min_sol,
      lastSlot: session.last_slot,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      totalSlotsScanned: session.total_slots_scanned,
      totalSwaps: session.total_swaps,
      totalTransfers: session.total_transfers,
      totalVolume: session.total_volume,
      creditsUsed: session.credits_used,
      errorCount: session.error_count,
      lastError: session.last_error,
      lastPollAt: session.last_poll_at,
    },
    totalAddresses: count || 0,
    addresses: (topAddresses || []).map((a: any) => ({
      address: a.address,
      timesSeen: a.times_seen,
      totalVolumeSol: Number(a.total_volume_sol),
      activityTypes: a.activity_types || [],
      sources: a.sources || [],
      lastSeen: a.last_seen_at,
    })),
  };
}

async function handleContinue(body: any) {
  const db = getDb();
  const { sessionId } = body;
  if (!sessionId) throw new Error("sessionId required");

  const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
  if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not configured");

  // Read session
  const { data: session } = await db
    .from("whale_scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");
  if (session.status !== "running") return { status: session.status, done: true };

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await db.from("whale_scan_sessions").update({ status: "completed" }).eq("id", sessionId);
    return { status: "completed", done: true };
  }

  // Update heartbeat
  await db.from("whale_scan_sessions").update({ last_poll_at: new Date().toISOString() }).eq("id", sessionId);

  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const minSolAmount = Number(session.min_sol) || 10;
  const slotsPerCall = session.slots_per_call || 5;
  const minLamports = minSolAmount * 1e9;

  try {
    // Get latest slot
    const slotRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [{ commitment: "confirmed" }] }),
    });
    const slotData = await slotRes.json();
    const latestSlot = slotData.result;

    let startSlot: number;
    if (session.last_slot && session.last_slot > 0) {
      startSlot = Number(session.last_slot) + 1;
    } else {
      startSlot = latestSlot;
    }

    const endSlot = Math.min(startSlot + slotsPerCall - 1, latestSlot);

    if (startSlot > latestSlot) {
      // Caught up, wait and re-call
      await new Promise(r => setTimeout(r, 2000));

      // Re-check session status before self-calling
      const { data: checkSession } = await db.from("whale_scan_sessions").select("status").eq("id", sessionId).single();
      if (checkSession?.status === "running") {
        selfCall(sessionId);
      }
      return { status: "waiting", slotsBehind: 0 };
    }

    // Scan slots
    const result = await scanSlots(rpcUrl, HELIUS_API_KEY, startSlot, endSlot, minLamports, minSolAmount);

    // Upsert addresses into DB
    if (result.wallets.length > 0) {
      // Aggregate wallets by address first
      const addrMap: Record<string, { totalVol: number; types: Set<string>; sources: Set<string>; count: number }> = {};
      for (const w of result.wallets) {
        if (!addrMap[w.address]) {
          addrMap[w.address] = { totalVol: 0, types: new Set(), sources: new Set(), count: 0 };
        }
        addrMap[w.address].totalVol += w.amountSol;
        addrMap[w.address].types.add(w.type);
        addrMap[w.address].sources.add(w.source);
        addrMap[w.address].count++;
      }

      // Batch upsert in chunks of 50
      const entries = Object.entries(addrMap);
      for (let i = 0; i < entries.length; i += 50) {
        const batch = entries.slice(i, i + 50);
        for (const [address, data] of batch) {
          // Check if exists
          const { data: existing } = await db
            .from("whale_addresses")
            .select("id, times_seen, total_volume_sol, activity_types, sources")
            .eq("session_id", sessionId)
            .eq("address", address)
            .maybeSingle();

          if (existing) {
            const mergedTypes = [...new Set([...(existing.activity_types || []), ...data.types])];
            const mergedSources = [...new Set([...(existing.sources || []), ...data.sources])];
            await db.from("whale_addresses").update({
              times_seen: existing.times_seen + data.count,
              total_volume_sol: Number(existing.total_volume_sol) + data.totalVol,
              activity_types: mergedTypes,
              sources: mergedSources,
              last_seen_at: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            await db.from("whale_addresses").insert({
              session_id: sessionId,
              address,
              times_seen: data.count,
              total_volume_sol: data.totalVol,
              activity_types: [...data.types],
              sources: [...data.sources],
              last_seen_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Count swaps and transfers in this batch
    const batchSwaps = result.wallets.filter(w => w.type === "SWAP").length;
    const batchTransfers = result.wallets.filter(w => w.type === "TRANSFER" || w.type === "NATIVE_TRANSFER").length;
    const batchVolume = result.wallets.reduce((s, w) => s + w.amountSol, 0);

    // Update session stats
    await db.from("whale_scan_sessions").update({
      last_slot: result.lastSuccessSlot,
      total_slots_scanned: (session.total_slots_scanned || 0) + result.slotsProcessed,
      total_swaps: (session.total_swaps || 0) + batchSwaps,
      total_transfers: (session.total_transfers || 0) + batchTransfers,
      total_volume: Number(session.total_volume || 0) + batchVolume,
      credits_used: (session.credits_used || 0) + result.creditsUsed + 1,
      error_count: 0, // Reset on success
      last_poll_at: new Date().toISOString(),
    }).eq("id", sessionId);

    // Self-call to continue
    const { data: checkSession } = await db.from("whale_scan_sessions").select("status").eq("id", sessionId).single();
    if (checkSession?.status === "running") {
      selfCall(sessionId);
    }

    return {
      status: "scanning",
      slotsProcessed: result.slotsProcessed,
      walletsFound: result.wallets.length,
      slotsBehind: latestSlot - result.lastSuccessSlot,
    };
  } catch (err: any) {
    console.error(`Scan error: ${err.message}`);

    const newErrorCount = (session.error_count || 0) + 1;
    const updates: any = {
      error_count: newErrorCount,
      last_error: err.message,
      last_poll_at: new Date().toISOString(),
    };

    if (newErrorCount >= 10) {
      updates.status = "failed";
    }

    await db.from("whale_scan_sessions").update(updates).eq("id", sessionId);

    // Self-call to retry if not failed
    if (newErrorCount < 10) {
      await new Promise(r => setTimeout(r, 3000)); // Wait before retry
      selfCall(sessionId);
    }

    return { status: newErrorCount >= 10 ? "failed" : "retrying", errorCount: newErrorCount, error: err.message };
  }
}

function selfCall(sessionId: string) {
  const selfUrl = `${SUPABASE_URL}/functions/v1/sol-whale-scanner`;
  fetch(selfUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: "continue", sessionId }),
  }).catch((e) => console.error("Self-call failed:", e.message));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "continue";

    let result: any;

    switch (action) {
      case "start":
        result = await handleStart(body);
        break;
      case "stop":
        result = await handleStop(body);
        break;
      case "status":
        result = await handleStatus(body);
        break;
      case "continue":
        result = await handleContinue(body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Whale scanner error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
