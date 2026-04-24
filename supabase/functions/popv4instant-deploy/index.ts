// PopShiba V4-Klik — one-time mainnet deploy of the singleton hook + factory.
//
// Klik architecture (no chicken-and-egg):
//   1. Hook(IPoolManager) deployed via CREATE2 at a salt-mined address whose
//      lower 14 bits == 0x20CC (beforeInitialize | beforeSwap | afterSwap |
//      beforeSwapReturnDelta | afterSwapReturnDelta).
//   2. Factory(hook) deployed normally with CREATE — only needs the hook
//      address, no factory-self-reference required.
//   3. After both are on-chain we wire them up:
//        hook.setFactory(factory)
//        hook.setPlatformTreasury(treasury)
//      Both are owner-only (owner = tx.origin from CREATE2 deploy = us).
//
// Body: { dryRun?: bool, treasury?: address, salt?: hex32, hookAddress?: address }
//   - First call with `{ dryRun: true }` → returns hookInitCodeHash to feed
//     into popv4instant-mine-salt.
//   - Second call with `{ salt, hookAddress }` → does the real deploy.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, formatEther,
  encodeAbiParameters, keccak256, getAddress, encodeDeployData,
  encodeFunctionData,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import PopKlikTokenArtifact from "./artifacts/PopKlikToken.ts";
import PopKlikHookArtifact from "./artifacts/PopKlikHook.ts";
import PopKlikFactoryArtifact from "./artifacts/PopKlikFactory.ts";

const ARTIFACT_NAMES = ["PopKlikToken", "PopKlikHook", "PopKlikFactory"] as const;
type ArtifactName = (typeof ARTIFACT_NAMES)[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POOL_MANAGER     = "0x000000000004444c5dc75cB358380D2e3dE08A90"; // V4 mainnet
const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const DEFAULT_TREASURY = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";

const RAW_ARTIFACTS: Record<ArtifactName, any> = {
  PopKlikToken: PopKlikTokenArtifact,
  PopKlikHook: PopKlikHookArtifact,
  PopKlikFactory: PopKlikFactoryArtifact,
};

function loadArtifacts(): Record<ArtifactName, { abi: any; bytecode: `0x${string}` }> {
  const out: any = {};
  for (const name of ARTIFACT_NAMES) {
    const j = RAW_ARTIFACTS[name];
    if (!j || !j.bytecode || !j.abi) {
      throw new Error(`Artifact ${name} missing or malformed (no abi/bytecode field).`);
    }
    const bc = j.bytecode as string;
    out[name] = { abi: j.abi, bytecode: (bc.startsWith("0x") ? bc : `0x${bc}`) as `0x${string}` };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({} as any));
    const dryRun = body.dryRun === true;
    const treasury = (body.treasury ?? DEFAULT_TREASURY) as `0x${string}`;

    const pk  = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!pk || !rpc) return json({ error: "Missing deployer secrets" }, 503);

    const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
    const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    const arts = loadArtifacts();

    // PopKlikHook constructor: (IPoolManager). Single arg, no factory reference.
    const hookCtor = encodeAbiParameters([{ type: "address" }], [POOL_MANAGER as `0x${string}`]);
    const hookInitCode = (arts.PopKlikHook.bytecode + hookCtor.slice(2)) as `0x${string}`;
    const hookInitCodeHash = keccak256(hookInitCode);

    if (dryRun) {
      return json({
        dryRun: true,
        deployer: account.address,
        treasury,
        poolManager: POOL_MANAGER,
        create2Deployer: CREATE2_DEPLOYER,
        hookInitCodeHash,
        nextStep: "POST popv4instant-mine-salt with { factory: CREATE2_DEPLOYER, initCodeHash: hookInitCodeHash }",
      });
    }

    const salt = body.salt as `0x${string}` | undefined;
    const expectedHook = body.hookAddress as `0x${string}` | undefined;
    if (!salt || !expectedHook) {
      return json({ error: "Real deploy needs { salt, hookAddress } from popv4instant-mine-salt" }, 400);
    }

    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < 50_000_000_000_000_000n /* 0.05 ETH */) {
      return json({ error: `Deployer balance too low: ${formatEther(balance)} ETH (need ≥ 0.05)` }, 503);
    }

    const txHashes: `0x${string}`[] = [];

    // 1. Deploy hook via canonical CREATE2 deployer (idempotent: skip if exists).
    const existingHookCode = await publicClient.getBytecode({ address: expectedHook });
    if (existingHookCode && existingHookCode !== "0x") {
      console.log(`Hook already deployed at ${expectedHook}, skipping CREATE2`);
    } else {
      const create2Data = (salt + hookInitCode.slice(2)) as `0x${string}`;
      const nonce1 = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
      const hookTx = await walletClient.sendTransaction({
        to: CREATE2_DEPLOYER as `0x${string}`,
        data: create2Data,
        nonce: nonce1,
      });
      const hookReceipt = await publicClient.waitForTransactionReceipt({ hash: hookTx });
      if (hookReceipt.status !== "success") return json({ error: "Hook deploy reverted", txHash: hookTx }, 500);
      txHashes.push(hookTx);

      const hookCode = await publicClient.getBytecode({ address: expectedHook });
      if (!hookCode || hookCode === "0x") return json({ error: "Hook bytecode missing at expected address", expectedHook }, 500);
    }

    // 2. Deploy factory (normal CREATE) with hook address.
    const factoryDeployData = encodeDeployData({
      abi: arts.PopKlikFactory.abi,
      bytecode: arts.PopKlikFactory.bytecode,
      args: [expectedHook],
    });
    const nonce2 = await publicClient.getTransactionCount({ address: account.address, blockTag: "latest" });
    const factoryTx = await walletClient.sendTransaction({ data: factoryDeployData, nonce: nonce2 });
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryTx });
    if (factoryReceipt.status !== "success") return json({ error: "Factory deploy reverted", txHash: factoryTx }, 500);
    if (!factoryReceipt.contractAddress) return json({ error: "Factory address missing in receipt" }, 500);
    txHashes.push(factoryTx);
    const factoryAddress = getAddress(factoryReceipt.contractAddress);

    // 3. Wire hook → factory and hook → treasury (owner-only, owner = us via tx.origin).
    const HOOK_ABI = [
      { type: "function", name: "setFactory", stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [] },
      { type: "function", name: "setPlatformTreasury", stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [] },
    ] as const;

    const setFactoryTx = await walletClient.sendTransaction({
      to: expectedHook,
      data: encodeFunctionData({ abi: HOOK_ABI, functionName: "setFactory", args: [factoryAddress] }),
    });
    const sfReceipt = await publicClient.waitForTransactionReceipt({ hash: setFactoryTx });
    if (sfReceipt.status !== "success") return json({ error: "hook.setFactory reverted", txHash: setFactoryTx, hook: expectedHook, factory: factoryAddress }, 500);
    txHashes.push(setFactoryTx);

    const setTreasuryTx = await walletClient.sendTransaction({
      to: expectedHook,
      data: encodeFunctionData({ abi: HOOK_ABI, functionName: "setPlatformTreasury", args: [treasury] }),
    });
    const stReceipt = await publicClient.waitForTransactionReceipt({ hash: setTreasuryTx });
    if (stReceipt.status !== "success") return json({ error: "hook.setPlatformTreasury reverted", txHash: setTreasuryTx }, 500);
    txHashes.push(setTreasuryTx);

    // 4. Persist deployment row.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("popv4instant_deployments").update({ is_active: false }).eq("network", "ethereum");
    const { data: row, error } = await supabase.from("popv4instant_deployments").insert({
      network: "ethereum",
      hook_address: expectedHook.toLowerCase(),
      factory_address: factoryAddress.toLowerCase(),
      treasury_address: treasury.toLowerCase(),
      hook_salt: salt,
      deployer: account.address.toLowerCase(),
      deploy_tx_hashes: txHashes,
      is_active: true,
    }).select().single();
    if (error) console.error("[popv4instant-deploy] DB insert failed:", error);

    return json({
      success: true,
      hook: expectedHook,
      factory: factoryAddress,
      treasury,
      txHashes,
      row,
    });
  } catch (e) {
    console.error("[popv4instant-deploy] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
