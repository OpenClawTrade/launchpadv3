// PopShiba V4 — one-time mainnet deploy of the singleton stack.
//
// 5 contracts, 5 transactions. Deploy ORDER MATTERS because the hook bakes
// the factory address into its constructor and must end up at a CREATE2
// address with lower-14-bits == 0x2A88. We solve the chicken-and-egg by
// predicting the factory address from the deployer's nonce BEFORE deploying
// the hook (CREATE address = keccak256(rlp([deployer, nonce]))[12:]).
//
// Deploy sequence (this function performs all 5):
//   1. PopBondingToken impl     (no constructor)        nonce = N
//   2. PopCurveImpl              (no constructor)        nonce = N+1
//   3. PopV4LpLocker(POSITION_MANAGER)                   nonce = N+2
//   4. PopBondingHookV4(PoolManager, predictedFactory) at MINED CREATE2 addr
//        - deployed via a tiny Create2Deployer contract pre-deployed at N+3
//   5. PopBondingFactoryV4(PoolManager, hook, curveImpl, tokenImpl, lpLocker, treasury)
//        - this is the deploy at the predicted address (nonce = N+4 after deployer)
//
// Body: { dryRun?: boolean, treasury?: string, salt?: string, hookAddress?: string }
//   - call dryRun first → returns the predicted factory address + the
//     initCodeHash you must feed to popv4-mine-salt
//   - then call popv4-mine-salt → returns { salt, hookAddress }
//   - then call this again with { salt, hookAddress } to do the real deploy

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, formatEther,
  encodeAbiParameters, getContractAddress, keccak256, getAddress,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";

// Artifacts are compiled by GitHub Actions (.github/workflows/compile-popshiba-v4.yml)
// using Foundry with viaIR + optimizer. The workflow commits the resulting JSONs
// into contracts/popshiba/v4/artifacts/ on every push, which Lovable auto-syncs
// back into this repo. The edge function reads them from raw.githubusercontent.com
// at deploy time — fully public, no secrets, always up-to-date with the latest .sol.
const ARTIFACT_BASE =
  "https://raw.githubusercontent.com/lovable-build/popshiba/main/contracts/popshiba/v4/artifacts";
const ARTIFACT_NAMES = [
  "PopBondingToken",
  "PopCurveImpl",
  "PopV4LpLocker",
  "PopBondingHookV4",
  "PopBondingFactoryV4",
] as const;
type ArtifactName = (typeof ARTIFACT_NAMES)[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POOL_MANAGER     = "0x000000000004444c5dc75cB358380D2e3dE08A90"; // V4 mainnet
const POSITION_MANAGER = "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e"; // V4 mainnet
const DEFAULT_TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe";

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

async function loadArtifacts(): Promise<Record<ArtifactName, { abi: any; bytecode: `0x${string}` }>> {
  const out: any = {};
  for (const name of ARTIFACT_NAMES) {
    const r = await fetch(`${ARTIFACT_BASE}/${name}.json`);
    if (!r.ok) {
      throw new Error(
        `Missing compiled artifact ${name} (HTTP ${r.status}). ` +
        `The GitHub Actions workflow hasn't built the contracts yet — ` +
        `push a commit touching contracts/popshiba/v4/*.sol or trigger the workflow manually.`,
      );
    }
    const json = await r.json();
    const bc = json.bytecode as string;
    out[name] = { abi: json.abi, bytecode: (bc.startsWith("0x") ? bc : `0x${bc}`) as `0x${string}` };
  }
  return out;
}

function bytecodeOf(a: { bytecode: `0x${string}` }): `0x${string}` {
  return a.bytecode;
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

    // Load artifacts from storage (compiled by popv4-compile)
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const arts = await loadArtifacts(supabase);

    const balance = await publicClient.getBalance({ address: account.address });
    const startNonce = await publicClient.getTransactionCount({ address: account.address });

    // Predicted addresses for the 3 simple deploys (regular CREATE)
    const predictedToken   = getContractAddress({ from: account.address, nonce: BigInt(startNonce + 0) });
    const predictedCurve   = getContractAddress({ from: account.address, nonce: BigInt(startNonce + 1) });
    const predictedLocker  = getContractAddress({ from: account.address, nonce: BigInt(startNonce + 2) });
    // Factory deploys LAST (nonce + 3 — hook is CREATE2 so it doesn't bump deployer nonce... wait, it does:
    // we send a tx TO Create2Deployer, that DOES bump deployer nonce by 1. So factory is at +4.)
    const predictedFactory = getContractAddress({ from: account.address, nonce: BigInt(startNonce + 4) });

    // Hook init-code = bytecode || abi.encode(POOL_MANAGER, predictedFactory)
    const hookInit = arts.PopBondingHookV4.bytecode +
      encodeAbiParameters(
        [{ type: "address" }, { type: "address" }],
        [POOL_MANAGER as `0x${string}`, predictedFactory]
      ).slice(2);
    const hookInitCodeHash = keccak256(hookInit as `0x${string}`);

    if (dryRun) {
      return json({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        ready: balance > 50_000_000_000_000_000n, // 0.05 ETH safety margin
        startNonce,
        treasury,
        poolManager: POOL_MANAGER,
        positionManager: POSITION_MANAGER,
        create2Deployer: CREATE2_DEPLOYER,
        predicted: {
          tokenImpl: predictedToken,
          curveImpl: predictedCurve,
          lpLocker:  predictedLocker,
          factory:   predictedFactory,
        },
        hookInitCodeHash,
        nextStep: `Call popv4-mine-salt with { factory: "${CREATE2_DEPLOYER}", initCodeHash: "${hookInitCodeHash}" }, then re-call this with { salt, hookAddress }.`,
      });
    }

    // ── REAL DEPLOY ──
    const salt = body.salt as `0x${string}` | undefined;
    const expectedHook = body.hookAddress as `0x${string}` | undefined;
    if (!salt || !expectedHook) {
      return json({ error: "salt + hookAddress required for real deploy. Run popv4-mine-salt first." }, 400);
    }
    if (balance < 50_000_000_000_000_000n) {
      return json({ error: `Need ≥0.05 ETH, have ${formatEther(balance)}` }, 400);
    }

    // 1. PopBondingToken impl
    const tokenHash = await walletClient.deployContract({ abi: [], bytecode: arts.PopBondingToken.bytecode } as any);
    const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenHash });
    const tokenImpl = tokenReceipt.contractAddress!;

    // 2. PopCurveImpl
    const curveHash = await walletClient.deployContract({ abi: [], bytecode: arts.PopCurveImpl.bytecode } as any);
    const curveReceipt = await publicClient.waitForTransactionReceipt({ hash: curveHash });
    const curveImpl = curveReceipt.contractAddress!;

    // 3. PopV4LpLocker(POSITION_MANAGER, PLATFORM_ADMIN=treasury)
    const lockerInit = arts.PopV4LpLocker.bytecode +
      encodeAbiParameters(
        [{ type: "address" }, { type: "address" }],
        [POSITION_MANAGER as `0x${string}`, treasury]
      ).slice(2);
    const lockerHash = await walletClient.deployContract({ abi: [], bytecode: lockerInit as `0x${string}` } as any);
    const lockerReceipt = await publicClient.waitForTransactionReceipt({ hash: lockerHash });
    const lpLocker = lockerReceipt.contractAddress!;

    // 4. Hook via CREATE2 deployer: tx data = salt(32) || initCode
    const create2Data = (salt + hookInit.slice(2)) as `0x${string}`;
    const hookHash = await walletClient.sendTransaction({
      to: CREATE2_DEPLOYER as `0x${string}`,
      data: create2Data,
    });
    await publicClient.waitForTransactionReceipt({ hash: hookHash });
    const code = await publicClient.getCode({ address: expectedHook });
    if (!code || code === "0x") {
      return json({ error: "Hook deploy failed — no code at expected address", expectedHook, hookHash }, 500);
    }
    const hookAddr = getAddress(expectedHook);

    // 5. PopBondingFactoryV4(poolManager, hook, curveImpl, tokenImpl, lpLocker, treasury)
    const factoryInit = arts.PopBondingFactoryV4.bytecode +
      encodeAbiParameters(
        [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
        [POOL_MANAGER as `0x${string}`, hookAddr, curveImpl, tokenImpl, lpLocker, treasury]
      ).slice(2);
    const factoryHash = await walletClient.deployContract({ abi: [], bytecode: factoryInit as `0x${string}` } as any);
    const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
    const factoryAddr = factoryReceipt.contractAddress!;

    if (getAddress(factoryAddr) !== getAddress(predictedFactory)) {
      return json({
        error: "Factory deployed at wrong address — predicted/actual mismatch. Hook FACTORY() will be wrong.",
        predicted: predictedFactory, actual: factoryAddr,
      }, 500);
    }

    // 6. Persist the deployment record (supabase client already created above)
    const { error: dbErr } = await supabase.from("bonding_deployments").insert({
      network: "mainnet-v4",
      deployer: account.address.toLowerCase(),
      factory_address: factoryAddr.toLowerCase(),
      curve_impl_address: curveImpl.toLowerCase(),
      token_impl_address: tokenImpl.toLowerCase(),
      event_bus_address: hookAddr.toLowerCase(),     // hook plays event-bus role in V4
      lp_locker_address: lpLocker.toLowerCase(),
      treasury_address: treasury.toLowerCase(),
      tx_hashes: [tokenHash, curveHash, lockerHash, hookHash, factoryHash],
      is_active: true,
    });
    if (dbErr) console.error("[popv4-deploy-factory] DB insert failed:", dbErr);

    return json({
      success: true,
      poolManager: POOL_MANAGER,
      positionManager: POSITION_MANAGER,
      tokenImpl, curveImpl, lpLocker, hook: hookAddr, factory: factoryAddr, treasury,
      txHashes: { tokenImpl: tokenHash, curveImpl: curveHash, lpLocker: lockerHash, hook: hookHash, factory: factoryHash },
      nextStep: `Add secret POP_V4_FACTORY_ADDRESS=${factoryAddr} and POP_V4_HOOK_ADDRESS=${hookAddr}, then call popv4-launch.`,
    });
  } catch (e) {
    console.error("[popv4-deploy-factory] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
