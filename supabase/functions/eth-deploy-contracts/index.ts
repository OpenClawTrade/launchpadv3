// ============================================================================
// eth-deploy-contracts
//
// One-shot deployment of the PopShiba Ethereum mainnet contract suite:
//   1. PopShibaToken implementation (clone master)
//   2. PopShibaCloneFactory (EIP-1167, points at #1)
//   3. PopShibaFeeVault (holds LP NFTs, splits fees 50/50)
//
// Then auto-verifies all 3 on Etherscan via the existing verification pipeline
// and persists addresses to public.eth_deployments.
//
// Required secrets:
//   - ETH_MAINNET_DEPLOYER_PRIVATE_KEY  (deployer wallet, must hold ≥0.05 ETH)
//   - ETHERSCAN_API_KEY                 (for verification)
//   - ETH_MAINNET_RPC_URL               (recommended; falls back to public RPCs)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createPublicClient, createWalletClient, http, fallback,
  parseEther, formatEther, encodeDeployData, encodeAbiParameters,
  type Address,
} from "https://esm.sh/viem@2.45.1";
import { mainnet } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";
import {
  POPSHIBA_TOKEN_BYTECODE, POPSHIBA_TOKEN_ABI,
  POPSHIBA_CLONE_FACTORY_BYTECODE, POPSHIBA_CLONE_FACTORY_ABI,
  POPSHIBA_FEE_VAULT_BYTECODE, POPSHIBA_FEE_VAULT_ABI,
  POPSHIBA_TOKEN_SOURCE, POPSHIBA_CLONE_FACTORY_SOURCE, POPSHIBA_FEE_VAULT_SOURCE,
} from "./contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ETHEREUM_CHAIN_ID = 1;
const PLATFORM_TREASURY = "0x8F7017df748Db75a58B3AA441ea0886dfEC16906" as const;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function verifyOnEtherscan(opts: {
  address: string;
  source: string;
  contractFile: string;
  contractName: string;
  encodedArgs: string;
  apiKey: string;
}): Promise<{ verified: boolean; message: string }> {
  // Wait for indexing
  for (let i = 0; i < 20; i++) {
    if (i > 0) await delay(6000);
    try {
      const r = await fetch(`https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=proxy&action=eth_getCode&address=${opts.address}&tag=latest&apikey=${opts.apiKey}`);
      const j = await r.json();
      if (j?.result && j.result !== "0x" && j.result.length > 10) break;
    } catch (_) {}
  }

  const standardJson = {
    language: "Solidity",
    sources: { [opts.contractFile]: { content: opts.source } },
    settings: {
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const form = new URLSearchParams();
  form.append("apikey", opts.apiKey);
  form.append("module", "contract");
  form.append("action", "verifysourcecode");
  form.append("contractaddress", opts.address);
  form.append("sourceCode", JSON.stringify(standardJson));
  form.append("codeformat", "solidity-standard-json-input");
  form.append("contractname", `${opts.contractFile}:${opts.contractName}`);
  form.append("compilerversion", "v0.8.20+commit.a1b79de6");
  form.append("constructorArguements", opts.encodedArgs);

  await delay(2000);
  const r = await fetch(`https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}`, { method: "POST", body: form });
  const result = await r.json();
  console.log(`[eth-deploy verify ${opts.contractName}] submit:`, result);

  if (result.status !== "1") {
    const msg = String(result.result || result.message || "Unknown");
    if (/already verified/i.test(msg)) return { verified: true, message: "already verified" };
    return { verified: false, message: msg };
  }

  const guid: string = result.result;
  for (let i = 0; i < 24; i++) {
    await delay(6000);
    try {
      const r = await fetch(`https://api.etherscan.io/v2/api?chainid=${ETHEREUM_CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${opts.apiKey}`);
      const j = await r.json();
      const txt = String(j?.result || "");
      if (/pass/i.test(txt)) return { verified: true, message: txt };
      if (/fail/i.test(txt) && !/pending/i.test(txt)) return { verified: false, message: txt };
    } catch (_) {}
  }
  return { verified: false, message: "polling timeout" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body?.dryRun === true;

    const PK = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    if (!PK) {
      return new Response(JSON.stringify({ error: "ETH_MAINNET_DEPLOYER_PRIVATE_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const account = privateKeyToAccount(PK.startsWith("0x") ? PK as `0x${string}` : `0x${PK}` as `0x${string}`);

    const alchemyKey = Deno.env.get("ALCHEMY_BSC_API_KEY");
    const rpcUrls = [
      Deno.env.get("ETH_MAINNET_RPC_URL"),
      alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : null,
      "https://cloudflare-eth.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
      "https://eth.drpc.org",
    ].filter(Boolean) as string[];
    const transport = fallback(rpcUrls.map((u) => http(u, { timeout: 20_000, retryCount: 1 })), { rank: false, retryCount: 2 });
    const wallet = createWalletClient({ account, chain: mainnet, transport });
    const pub = createPublicClient({ chain: mainnet, transport });

    const balance = await pub.getBalance({ address: account.address });
    const balanceEth = formatEther(balance);
    const minBalance = parseEther("0.05");

    if (balance < minBalance) {
      return new Response(JSON.stringify({
        error: "Insufficient balance",
        deployer: account.address,
        balance: `${balanceEth} ETH`,
        required: "0.05 ETH minimum",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      const nonce = await pub.getTransactionCount({ address: account.address });
      return new Response(JSON.stringify({
        dryRun: true,
        deployer: account.address,
        balance: `${balanceEth} ETH`,
        nonce,
        ready: true,
        willDeploy: ["PopShibaToken (impl)", "PopShibaCloneFactory", "PopShibaFeeVault"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- 1. Deploy PopShibaToken implementation ----
    console.log("[eth-deploy] 1/3 deploying PopShibaToken implementation...");
    const implDeployData = encodeDeployData({
      abi: POPSHIBA_TOKEN_ABI as any, bytecode: POPSHIBA_TOKEN_BYTECODE, args: [] as any,
    });
    const implHash = await wallet.sendTransaction({ to: null as any, data: implDeployData, value: 0n });
    const implRcpt = await pub.waitForTransactionReceipt({ hash: implHash });
    const implAddress = implRcpt.contractAddress!;
    console.log("[eth-deploy] PopShibaToken impl:", implAddress);

    // ---- 2. Deploy PopShibaCloneFactory(impl) ----
    console.log("[eth-deploy] 2/3 deploying PopShibaCloneFactory...");
    const factoryDeployData = encodeDeployData({
      abi: POPSHIBA_CLONE_FACTORY_ABI as any, bytecode: POPSHIBA_CLONE_FACTORY_BYTECODE, args: [implAddress] as any,
    });
    const factoryHash = await wallet.sendTransaction({ to: null as any, data: factoryDeployData, value: 0n });
    const factoryRcpt = await pub.waitForTransactionReceipt({ hash: factoryHash });
    const factoryAddress = factoryRcpt.contractAddress!;
    console.log("[eth-deploy] PopShibaCloneFactory:", factoryAddress);

    // ---- 3. Deploy PopShibaFeeVault(treasury) ----
    console.log("[eth-deploy] 3/3 deploying PopShibaFeeVault...");
    const vaultDeployData = encodeDeployData({
      abi: POPSHIBA_FEE_VAULT_ABI as any, bytecode: POPSHIBA_FEE_VAULT_BYTECODE, args: [PLATFORM_TREASURY] as any,
    });
    const vaultHash = await wallet.sendTransaction({ to: null as any, data: vaultDeployData, value: 0n });
    const vaultRcpt = await pub.waitForTransactionReceipt({ hash: vaultHash });
    const vaultAddress = vaultRcpt.contractAddress!;
    console.log("[eth-deploy] PopShibaFeeVault:", vaultAddress);

    // ---- Persist addresses BEFORE verification (verification can take 5min) ----
    await supabase.from("eth_deployments").update({ is_active: false })
      .eq("network", "mainnet").eq("is_active", true);

    const { data: depRow } = await supabase.from("eth_deployments").insert({
      network: "mainnet",
      deployer: account.address,
      contracts: {
        PopShibaToken: implAddress,
        PopShibaCloneFactory: factoryAddress,
        PopShibaFeeVault: vaultAddress,
        platformTreasury: PLATFORM_TREASURY,
      },
      tx_hashes: [implHash, factoryHash, vaultHash],
      vault_address: vaultAddress,
      clone_factory_address: factoryAddress,
      token_impl_address: implAddress,
      deployed_at: new Date().toISOString(),
      is_active: true,
      verified: false,
    }).select("id").single();

    // ---- Auto-verify all 3 on Etherscan (background — don't block) ----
    const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
    if (apiKey && depRow?.id) {
      const verifyTask = (async () => {
        const tokenArgs = ""; // no constructor args
        const factoryArgs = encodeAbiParameters([{ type: "address" }], [implAddress as `0x${string}`]).slice(2);
        const vaultArgs = encodeAbiParameters([{ type: "address" }], [PLATFORM_TREASURY]).slice(2);

        const [r1, r2, r3] = await Promise.all([
          verifyOnEtherscan({ address: implAddress, source: POPSHIBA_TOKEN_SOURCE, contractFile: "PopShibaToken.sol", contractName: "PopShibaToken", encodedArgs: tokenArgs, apiKey }),
          verifyOnEtherscan({ address: factoryAddress, source: POPSHIBA_CLONE_FACTORY_SOURCE, contractFile: "PopShibaCloneFactory.sol", contractName: "PopShibaCloneFactory", encodedArgs: factoryArgs, apiKey }),
          verifyOnEtherscan({ address: vaultAddress, source: POPSHIBA_FEE_VAULT_SOURCE, contractFile: "PopShibaFeeVault.sol", contractName: "PopShibaFeeVault", encodedArgs: vaultArgs, apiKey }),
        ]);
        console.log("[eth-deploy] verification results:", { r1, r2, r3 });
        const allVerified = r1.verified && r2.verified && r3.verified;
        await supabase.from("eth_deployments").update({ verified: allVerified }).eq("id", depRow.id);
      })();
      verifyTask.catch((e) => console.error("[eth-deploy] verify task error:", e));
    }

    return new Response(JSON.stringify({
      success: true,
      network: "mainnet",
      deployer: account.address,
      contracts: {
        PopShibaToken: implAddress,
        PopShibaCloneFactory: factoryAddress,
        PopShibaFeeVault: vaultAddress,
      },
      tx_hashes: [implHash, factoryHash, vaultHash],
      gasUsedEth: formatEther((implRcpt.gasUsed + factoryRcpt.gasUsed + vaultRcpt.gasUsed) * (implRcpt.effectiveGasPrice ?? 0n)),
      message: "Deployed. Etherscan verification running in background (~3-5 min).",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-deploy] error", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Deployment failed",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
