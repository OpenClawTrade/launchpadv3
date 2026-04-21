// 0x Swap API v2 (allowance-holder) edge function
// Builds swap transactions for ETH + BNB with a 1% platform fee.
// Records trades in alpha_trades after the client submits the tx.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLATFORM_FEE_BPS = "100"; // 1%
const PLATFORM_FEE_RECIPIENT = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";

// 0x v2 supports many chains. We expose ETH + BNB for now.
const CHAINS: Record<string, { chainId: number; nativeWrapped: string; native: string; explorer: string; symbol: string }> = {
  eth: {
    chainId: 1,
    nativeWrapped: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    native: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    explorer: "https://etherscan.io/tx/",
    symbol: "ETH",
  },
  bnb: {
    chainId: 56,
    nativeWrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    native: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    explorer: "https://bscscan.com/tx/",
    symbol: "BNB",
  },
};

const ZEROX_BASE = "https://api.0x.org";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      mode, // "quote" | "record"
      chain, // "eth" | "bnb"
      action, // "buy" | "sell"
      tokenAddress, // the meme/target token
      amount, // human units (e.g., "0.05")
      userWallet,
      slippageBps = 100, // default 1%
      privyUserId,
      // record-only:
      txHash,
      tokenName,
      tokenTicker,
      estimatedOutput,
    } = body || {};

    const chainCfg = CHAINS[(chain || "").toLowerCase()];
    if (!chainCfg) {
      return json({ success: false, error: `Unsupported chain: ${chain}` }, 400);
    }

    // ===== RECORD MODE =====
    if (mode === "record") {
      if (!txHash || !userWallet || !tokenAddress) {
        return json({ success: false, error: "Missing record fields" }, 400);
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("alpha_trades").insert({
        wallet_address: userWallet,
        token_mint: tokenAddress,
        token_name: tokenName || null,
        token_ticker: tokenTicker || null,
        trade_type: action === "buy" ? "buy" : "sell",
        amount_sol: Number(amount) || 0,
        amount_tokens: Number(estimatedOutput) || 0,
        tx_hash: txHash,
        chain,
      });
      return json({ success: true });
    }

    // ===== QUOTE / BUILD MODE =====
    const ZEROX_API_KEY = Deno.env.get("ZEROX_API_KEY");
    if (!ZEROX_API_KEY) return json({ success: false, error: "ZEROX_API_KEY not configured" }, 500);
    if (!tokenAddress || !userWallet || !amount) {
      return json({ success: false, error: "Missing required fields" }, 400);
    }

    // Determine sellToken / buyToken
    let sellToken: string;
    let buyToken: string;
    let sellAmountWei: bigint;

    // For buy: user spends native (ETH/BNB) to get the token
    // For sell: user spends the token to get native
    if (action === "buy") {
      sellToken = chainCfg.native;
      buyToken = tokenAddress;
      sellAmountWei = BigInt(Math.floor(Number(amount) * 1e18));
    } else {
      sellToken = tokenAddress;
      buyToken = chainCfg.native;
      // Need token decimals — fetch via 0x metadata (simpler: assume 18, common for ERC20 memecoins)
      // We'll let client pass decimals later if needed. Default 18.
      const decimals = body.tokenDecimals ?? 18;
      sellAmountWei = BigInt(Math.floor(Number(amount) * 10 ** decimals));
    }

    const params = new URLSearchParams({
      chainId: String(chainCfg.chainId),
      sellToken,
      buyToken,
      sellAmount: sellAmountWei.toString(),
      taker: userWallet,
      slippageBps: String(slippageBps),
      swapFeeRecipient: PLATFORM_FEE_RECIPIENT,
      swapFeeBps: PLATFORM_FEE_BPS,
      swapFeeToken: buyToken, // collect fee in the OUTPUT token
      tradeSurplusRecipient: PLATFORM_FEE_RECIPIENT, // bonus: keep positive slippage
    });

    const url = `${ZEROX_BASE}/swap/allowance-holder/quote?${params.toString()}`;
    console.log("[zerox-swap] quote:", url);

    const resp = await fetch(url, {
      headers: {
        "0x-api-key": ZEROX_API_KEY,
        "0x-version": "v2",
      },
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[zerox-swap] 0x error:", data);
      return json({ success: false, error: data?.reason || data?.detail || "0x quote failed", details: data }, 400);
    }

    return json({
      success: true,
      chainId: chainCfg.chainId,
      explorerBase: chainCfg.explorer,
      transaction: data.transaction, // { to, data, value, gas, gasPrice }
      buyAmount: data.buyAmount,
      sellAmount: data.sellAmount,
      minBuyAmount: data.minBuyAmount,
      route: data.route,
      issues: data.issues, // includes allowance issue if approval needed
      fees: data.fees,
      totalNetworkFee: data.totalNetworkFee,
    });
  } catch (e: any) {
    console.error("[zerox-swap] error:", e);
    return json({ success: false, error: e?.message || "Unknown error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
