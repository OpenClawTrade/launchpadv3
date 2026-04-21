// ============================================================================
// eth-collect-fees
//
// Calls PopShibaFeeVault.collect(token) for each registered LP. The vault
// pulls fees from Uniswap V3, sends platform's 50% straight to treasury, and
// credits creator's 50% to `creatorOwed[token]` (held in WETH inside vault).
//
// We mirror the on-chain state into eth_creator_fee_ledger so the dashboard
// can show lifetime/owed/paid without RPC calls.
//
// Triggers:
//   - Cron (every ~6h) — POST {} (no body) — collects all positions
//   - Manual single-token — POST { tokenAddress: "0x..." }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient, createWalletClient, http, parseAbi, type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAULT_ABI = parseAbi([
  "function collect(address token) returns (uint256 wethCollected)",
  "function lifetimeCollected(address token) view returns (uint256)",
  "function creatorOwed(address token) view returns (uint256)",
  "function creatorPaid(address token) view returns (uint256)",
  "function platformPaid(address token) view returns (uint256)",
  "function tokens(address) view returns (uint256 lpTokenId, address creator, bool registered)",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const targetToken: string | undefined = body?.tokenAddress;

    const PK = Deno.env.get("ETH_LP_HOLDER_PRIVATE_KEY");
    if (!PK) throw new Error("Missing ETH_LP_HOLDER_PRIVATE_KEY");
    const RPC = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mainnet, transport: http(RPC) });
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve active vault from eth_deployments
    const { data: deployment } = await supabase
      .from("eth_deployments")
      .select("vault_address")
      .eq("is_active", true)
      .eq("network", "mainnet")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!deployment?.vault_address) {
      throw new Error("No active eth_deployments.vault_address");
    }
    const VAULT = deployment.vault_address as Address;

    let q = supabase.from("eth_lp_positions").select("*").eq("chain_id", 1);
    if (targetToken) q = q.eq("token_address", targetToken.toLowerCase());
    const { data: positions, error } = await q;
    if (error) throw error;
    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({ success: true, collected: 0, message: "No positions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const pos of positions) {
      try {
        const tokenAddr = pos.token_address as Address;

        // Verify the token is registered in the vault. If not, skip.
        const reg = await pub.readContract({
          address: VAULT, abi: VAULT_ABI, functionName: "tokens", args: [tokenAddr],
        }) as readonly [bigint, string, boolean];
        if (!reg[2]) {
          results.push({ tokenAddress: tokenAddr, skipped: true, reason: "not registered in vault" });
          continue;
        }

        // Simulate vault.collect — returns wethCollected (already split 50/50).
        let collectHash: string | undefined;
        let wethCollected = 0n;
        try {
          const sim = await pub.simulateContract({
            account, address: VAULT, abi: VAULT_ABI, functionName: "collect", args: [tokenAddr],
          });
          wethCollected = sim.result as bigint;
        } catch (simErr) {
          // Simulation reverted — usually means there's nothing to collect.
          results.push({
            tokenAddress: tokenAddr, skipped: true,
            reason: `simulate reverted: ${simErr instanceof Error ? simErr.message.slice(0, 120) : "unknown"}`,
          });
          continue;
        }

        if (wethCollected > 0n) {
          collectHash = await wallet.writeContract({
            address: VAULT, abi: VAULT_ABI, functionName: "collect", args: [tokenAddr],
          });
          await pub.waitForTransactionReceipt({ hash: collectHash as `0x${string}` });
        }

        // Read authoritative on-chain state and mirror into ledger.
        const [lifetime, owed, paid] = await Promise.all([
          pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "lifetimeCollected", args: [tokenAddr] }) as Promise<bigint>,
          pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "creatorOwed", args: [tokenAddr] }) as Promise<bigint>,
          pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "creatorPaid", args: [tokenAddr] }) as Promise<bigint>,
        ]);

        const creatorShareWeth = lifetime / 2n;
        await supabase.from("eth_creator_fee_ledger").upsert({
          token_address: tokenAddr,
          creator_wallet: pos.creator_wallet,
          lp_token_id: pos.lp_token_id,
          total_collected_weth: lifetime.toString(),
          creator_share_weth: creatorShareWeth.toString(),
          creator_paid_weth: paid.toString(),
          last_collect_at: new Date().toISOString(),
          chain_id: 1,
        }, { onConflict: "token_address" });

        results.push({
          tokenAddress: tokenAddr,
          collectHash,
          collectedThisCall: wethCollected.toString(),
          lifetime: lifetime.toString(),
          creatorOwed: owed.toString(),
          creatorPaid: paid.toString(),
        });
      } catch (e) {
        console.error("[eth-collect-fees] failed for", pos.token_address, e);
        results.push({ tokenAddress: pos.token_address, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, collected: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-collect-fees] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
