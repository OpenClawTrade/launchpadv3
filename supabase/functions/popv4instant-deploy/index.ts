// PopShiba V4-Instant — one-time mainnet deploy of the singleton hook + factory.
//
// Two contracts, two transactions (plus salt mining out-of-band):
//   1. PopInstantHook deployed via CREATE2 at a mined address whose lower
//      14 bits == 0x10C4 (afterInitialize | beforeSwap | afterSwap |
//      afterSwapReturnsDelta). Constructor args: (PoolManager, factory_predicted, treasury).
//   2. PopInstantFactory deployed normally (CREATE) at the predicted address.
//      Constructor args: (PoolManager, hook_address, treasury).
//
// Chicken-and-egg: the hook's constructor needs the factory address, but
// the factory needs the hook. We solve it by predicting the factory's CREATE
// address from (deployer, nonce+1) BEFORE deploying the hook.
//
// Body: { dryRun?: bool, treasury?: address, salt?: hex32, hookAddress?: address }
//   - First call with `{ dryRun: true }` → returns predicted factory address +
//     initCodeHash to feed into popv4instant-mine-salt.
//   - Second call with `{ salt, hookAddress }` → does the real deploy.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, formatEther,
  encodeAbiParameters, getContractAddress, keccak256, getAddress,
  encodeDeployData,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";

const ARTIFACT_NAMES = ["PopInstantToken", "PopInstantHook", "PopInstantFactory"] as const;
type ArtifactName = (typeof ARTIFACT_NAMES)[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POOL_MANAGER     = "0x000000000004444c5dc75cB358380D2e3dE08A90"; // V4 mainnet
const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const DEFAULT_TREASURY = "0x9FD5f2E480F43320E8F65072A739c941cb5b10B0";

async function loadArtifacts(): Promise<Record<ArtifactName, { abi: any; bytecode: `0x${string}` }>> {
  const out: any = {};
  for (const name of ARTIFACT_NAMES) {
    const url = new URL(`./artifacts/${name}.json`, import.meta.url);
    let text: string;
    try {
      text = await Deno.readTextFile(url);
    } catch (e) {
      throw new Error(
        `Missing compiled artifact ${name}.json. The GitHub Actions workflow ` +
        `(compile-popshiba-v4-instant.yml) hasn't built it yet — push a change ` +
        `to contracts/popshiba/v4-instant/*.sol or trigger it manually. ` +
        `(${e instanceof Error ? e.message : String(e)})`,
      );
    }
    const j = JSON.parse(text);
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

    const arts = await loadArtifacts();

    // The factory will be deployed AFTER the hook (CREATE2). Predict its
    // CREATE address using (deployer, currentNonce+0) since the hook isn't
    // a CREATE deploy from this account. Wait — CREATE2 via the canonical
    // deployer doesn't bump our nonce. So the factory will be at nonce N.
    const currentNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    const predictedFactory = getContractAddress({ from: account.address, nonce: BigInt(currentNonce) });

    // Hook init code = creationCode ++ encode(PoolManager, predictedFactory, treasury)
    const hookCtor = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }],
      [POOL_MANAGER as `0x${string}`, predictedFactory, treasury],
    );
    const hookInitCode = (arts.PopInstantHook.bytecode + hookCtor.slice(2)) as `0x${string}`;
    const hookInitCodeHash = keccak256(hookInitCode);

    if (dryRun) {
      return json({
        dryRun: true,
        deployer: account.address,
        predictedFactory,
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

    // 1. Deploy hook via canonical CREATE2 deployer.
    //    Calldata = salt(32) || initCode(...).
    const create2Data = (salt + hookInitCode.slice(2)) as `0x${string}`;
    const hookTx = await walletClient.sendTransaction({
      to: CREATE2_DEPLOYER as `0x${string}`,
      data: create2Data,
    });
    const hookReceipt = await publicClient.waitForTransactionReceipt({ hash: hookTx });
    if (hookReceipt.status !== "success") return json({ error: "Hook deploy reverted", txHash: hookTx }, 500);
    txHashes.push(hookTx);

    // Verify the hook actually lives at the expected address.
    const hookCode = await publicClient.getBytecode({ address: expectedHook });
    if (!hookCode || hookCode === "0x") return json({ error: "Hook bytecode missing at expected address", expectedHook }, 500);

    // 2. Deploy factory (normal CREATE).
    const factoryDeployData = encodeDeployData({
      abi: arts.PopInstantFactory.abi,
      bytecode: arts.PopInstantFactory.bytecode,
      args: [POOL_MANAGER, expectedHook, treasury],
    });
    const factoryTx = await walletClient.sendTransaction({ data: factoryDeployData });
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryTx });
    if (factoryReceipt.status !== "success") return json({ error: "Factory deploy reverted", txHash: factoryTx }, 500);
    if (!factoryReceipt.contractAddress) return json({ error: "Factory address missing in receipt" }, 500);
    txHashes.push(factoryTx);

    const factoryAddress = getAddress(factoryReceipt.contractAddress);
    if (factoryAddress.toLowerCase() !== predictedFactory.toLowerCase()) {
      return json({
        error: "Factory deployed at unexpected address — nonce drift?",
        expected: predictedFactory, actual: factoryAddress,
      }, 500);
    }

    // 3. Persist deployment row.
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
