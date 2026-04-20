// ============================================================================
// eth-claim-creator-fees
//
// User-triggered. Pays the creator their accrued 50% of WETH (unwrapped to
// ETH where possible) for a given token.
//
// Body: { tokenAddress: "0x...", creatorWallet: "0x..." }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient, createWalletClient, http, parseAbi, getAddress, type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const WETH_ABI = parseAbi([
  "function withdraw(uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
]);

const isEvmAddress = (a: unknown): a is string =>
  typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (!isEvmAddress(body?.tokenAddress) || !isEvmAddress(body?.creatorWallet)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress or creatorWallet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tokenAddress = body.tokenAddress.toLowerCase();
    const creatorWallet = getAddress(body.creatorWallet) as Address;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ledger, error } = await supabase
      .from("eth_creator_fee_ledger")
      .select("*")
      .eq("token_address", tokenAddress)
      .single();
    if (error || !ledger) throw new Error("No ledger entry for this token");

    if (ledger.creator_wallet.toLowerCase() !== creatorWallet.toLowerCase()) {
      return new Response(JSON.stringify({ success: false, error: "Not the creator of this token" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const share = BigInt(ledger.creator_share_weth || "0");
    const paid = BigInt(ledger.creator_paid_weth || "0");
    const owed = share > paid ? share - paid : 0n;
    if (owed === 0n) {
      return new Response(JSON.stringify({ success: false, error: "Nothing to claim", owed: "0" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fees live in the LP holder wallet (0x8F70…6906), so claims pay out from there.
    const PK = Deno.env.get("ETH_LP_HOLDER_PRIVATE_KEY");
    if (!PK) throw new Error("Missing ETH_LP_HOLDER_PRIVATE_KEY (LP NFT holder)");
    const RPC = Deno.env.get("ETH_MAINNET_RPC_URL") || "https://eth.llamarpc.com";
    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);
    const wallet = createWalletClient({ account, chain: mainnet, transport: http(RPC) });
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });

    // Try unwrap WETH → send ETH. Fallback: send WETH directly.
    let txHash: string;
    let mode: string;
    try {
      const wethBal = await pub.readContract({ address: WETH, abi: WETH_ABI, functionName: "balanceOf", args: [account.address] }) as bigint;
      if (wethBal < owed) throw new Error("Insufficient WETH in deployer to unwrap");
      const unwrapHash = await wallet.writeContract({
        address: WETH, abi: WETH_ABI, functionName: "withdraw", args: [owed],
      });
      await pub.waitForTransactionReceipt({ hash: unwrapHash });
      txHash = await wallet.sendTransaction({ to: creatorWallet, value: owed });
      await pub.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      mode = "eth";
    } catch (e) {
      console.warn("[eth-claim] unwrap failed, sending WETH instead:", e);
      txHash = await wallet.writeContract({
        address: WETH, abi: WETH_ABI, functionName: "transfer", args: [creatorWallet, owed],
      });
      await pub.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      mode = "weth";
    }

    await supabase.from("eth_creator_fee_ledger").update({
      creator_paid_weth: (paid + owed).toString(),
      last_claim_at: new Date().toISOString(),
      last_claim_tx: txHash,
    }).eq("token_address", tokenAddress);

    return new Response(JSON.stringify({
      success: true, txHash, mode, claimedWeth: owed.toString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-claim-creator-fees] error", err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
