// PopShiba V4 — one-time factory deployer.
// Run this ONCE on Ethereum mainnet. It deploys:
//   1. PopBondingToken (impl, used as EIP-1167 clone target)
//   2. PopBondingFactoryV4 (constructor: poolManager, tokenImpl, treasury)
// Then add the resulting factory address as POP_V4_FACTORY_ADDRESS secret.
//
// Body: { dryRun?: boolean, treasury?: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, formatEther,
  encodeAbiParameters, getContractAddress,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import TokenArtifact from "./artifacts/PopBondingToken.json" with { type: "json" };
import FactoryArtifact from "./artifacts/PopBondingFactoryV4.json" with { type: "json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90"; // Uniswap V4 mainnet
const DEFAULT_TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({} as any));
    const dryRun = body.dryRun === true;
    const treasury = (body.treasury ?? DEFAULT_TREASURY) as `0x${string}`;

    const pk = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const balance = await publicClient.getBalance({ address: account.address });

    if (dryRun) {
      const nonce = await publicClient.getTransactionCount({ address: account.address });
      const tokenAddr = getContractAddress({ from: account.address, nonce: BigInt(nonce) });
      const factoryAddr = getContractAddress({ from: account.address, nonce: BigInt(nonce + 1) });
      return json({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        ready: balance > 30_000_000_000_000_000n,
        treasury,
        poolManager: POOL_MANAGER,
        predictedTokenImpl: tokenAddr,
        predictedFactory: factoryAddr,
      });
    }

    if (balance < 30_000_000_000_000_000n) {
      return json({ error: `Need at least 0.03 ETH, have ${formatEther(balance)}` }, 400);
    }

    // 1. Deploy PopBondingToken impl (no constructor args)
    const tokenBytecode = (TokenArtifact as any).bytecode as string;
    const tokenInit = (tokenBytecode.startsWith("0x") ? tokenBytecode : `0x${tokenBytecode}`) as `0x${string}`;
    const tokenHash = await walletClient.deployContract({
      abi: [],
      bytecode: tokenInit,
    } as any);
    const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
    const tokenImpl = tokenReceipt.contractAddress!;

    // 2. Deploy PopBondingFactoryV4(poolManager, tokenImpl, treasury)
    const factoryBytecode = (FactoryArtifact as any).bytecode as string;
    const factoryInit = (factoryBytecode.startsWith("0x") ? factoryBytecode : `0x${factoryBytecode}`) +
      encodeAbiParameters(
        [{ type: "address" }, { type: "address" }, { type: "address" }],
        [POOL_MANAGER as `0x${string}`, tokenImpl, treasury]
      ).slice(2);
    const factoryHash = await walletClient.deployContract({
      abi: [],
      bytecode: factoryInit as `0x${string}`,
    } as any);
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
    const factoryAddr = factoryReceipt.contractAddress!;

    return json({
      success: true,
      poolManager: POOL_MANAGER,
      tokenImpl,
      factory: factoryAddr,
      treasury,
      txHashes: { tokenImpl: tokenHash, factory: factoryHash },
      nextStep: `Add secret POP_V4_FACTORY_ADDRESS=${factoryAddr} then call popv4-launch.`,
    });
  } catch (e) {
    console.error("[popv4-deploy-factory] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
