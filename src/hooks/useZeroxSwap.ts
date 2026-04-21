import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";

export type ApeChain = "eth" | "bnb";

const CHAIN_HEX: Record<ApeChain, string> = {
  eth: "0x1",
  bnb: "0x38",
};

const CHAIN_PARAMS: Record<ApeChain, any> = {
  eth: {
    chainId: "0x1",
    chainName: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  bnb: {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

// Flashbots Protect for ETH (anti-MEV)
const FLASHBOTS_RPC = "https://rpc.flashbots.net/fast";

interface SwapOpts {
  chain: ApeChain;
  tokenAddress: string;
  action: "buy" | "sell";
  amount: number;
  slippageBps?: number; // default 100 (1%)
  tokenDecimals?: number; // for sells
  gasTier?: "standard" | "fast" | "instant";
  antiMev?: boolean; // ETH only
  tokenName?: string;
  tokenTicker?: string;
}

interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
  buyAmount?: string;
  route?: any;
}

export function useZeroxSwap() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = usePrivy();
  const { wallet: evmWallet, address } = usePrivyEvmWallet();

  const executeApeSwap = useCallback(async (opts: SwapOpts): Promise<SwapResult> => {
    setIsLoading(true);
    try {
      if (!evmWallet || !address) throw new Error("EVM wallet not ready");

      // 1. Get quote from 0x via edge function
      const { data: quote, error: quoteErr } = await supabase.functions.invoke("zerox-swap", {
        body: {
          mode: "quote",
          chain: opts.chain,
          action: opts.action,
          tokenAddress: opts.tokenAddress,
          amount: opts.amount.toString(),
          userWallet: address,
          slippageBps: opts.slippageBps ?? 100,
          tokenDecimals: opts.tokenDecimals,
          privyUserId: user?.id,
        },
      });

      if (quoteErr) throw new Error(quoteErr.message || "Quote failed");
      if (!quote?.success) throw new Error(quote?.error || "Quote failed");

      const { transaction, issues, explorerBase, buyAmount, route } = quote;
      if (!transaction) throw new Error("No transaction returned from 0x");

      // 2. Get provider
      const provider = await (evmWallet as any).getEthereumProvider();
      if (!provider) throw new Error("No wallet provider");

      // 3. Switch to correct chain
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_HEX[opts.chain] }],
        });
      } catch (e: any) {
        if (e?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [CHAIN_PARAMS[opts.chain]],
          });
        }
      }

      // 4. Handle ERC20 approval if needed (sells)
      if (issues?.allowance && issues.allowance.actual !== undefined) {
        const allowanceTarget = issues.allowance.spender;
        const erc20 = opts.tokenAddress;
        // Encode approve(spender, MAX_UINT)
        const MAX = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const spenderPad = allowanceTarget.replace(/^0x/, "").padStart(64, "0");
        const approveData = "0x095ea7b3" + spenderPad + MAX;
        const approveHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: address,
            to: erc20,
            data: approveData,
            value: "0x0",
          }],
        });
        await waitForTx(provider, approveHash);
      }

      // 5. Apply gas tier
      const txParams: any = {
        from: address,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value ? "0x" + BigInt(transaction.value).toString(16) : "0x0",
      };
      if (transaction.gas) {
        const gasNum = BigInt(transaction.gas);
        const multiplier = opts.gasTier === "instant" ? 150n : opts.gasTier === "fast" ? 120n : 110n;
        txParams.gas = "0x" + ((gasNum * multiplier) / 100n).toString(16);
      }

      // 6. Send tx (Flashbots for ETH if antiMev)
      // Note: Privy embedded wallets send via their RPC; routing per-tx through Flashbots
      // requires raw signing. For now we expose it as a flag and document: anti-MEV will be
      // wired via Flashbots Protect in a follow-up that adds raw-signing helpers.
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      // 7. Record trade (background)
      supabase.functions.invoke("zerox-swap", {
        body: {
          mode: "record",
          chain: opts.chain,
          action: opts.action,
          tokenAddress: opts.tokenAddress,
          userWallet: address,
          amount: opts.amount.toString(),
          txHash,
          tokenName: opts.tokenName,
          tokenTicker: opts.tokenTicker,
          estimatedOutput: buyAmount,
          privyUserId: user?.id,
        },
      }).catch(() => {});

      return {
        success: true,
        txHash,
        explorerUrl: `${explorerBase}${txHash}`,
        buyAmount,
        route,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "Swap failed" };
    } finally {
      setIsLoading(false);
    }
  }, [evmWallet, address, user?.id]);

  return { executeApeSwap, isLoading, walletAddress: address };
}

async function waitForTx(provider: any, txHash: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt) return;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
}
