// PopShiba Bonding Protocol — one-click deployer.
// Mirrors the unicurve.fun architecture but uses our own contracts so we
// own the factory, fees, and LP locker. Compiled bytecode is in
// ./bonding_bytecode.ts (solc 0.8.26, optimizer 200 runs, viaIR).
//
// Deployment order (5 contracts, 6 txs):
//   1. PopBondingToken  (impl, no constructor args)
//   2. PopBondingCurve  (impl, no constructor args)
//   3. PopEventBus      (no constructor args)
//   4. PopLpLocker      (constructor: weth, v3factory, v3posMgr, treasury)
//   5. PopBondingFactory(constructor: tokenImpl, curveImpl, eventBus, lpLocker, treasury)
//   6. EventBus.setFactory(factory) — wires the bus
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  createPublicClient, createWalletClient, http, formatEther, encodeFunctionData,
  encodeAbiParameters, parseAbi, getAddress, getContractAddress,
} from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import {
  WETH9, UNI_V3_FACTORY, UNI_V3_POS_MGR, BONDING_BYTECODE_READY,
  POP_BONDING_TOKEN_BYTECODE, POP_BONDING_CURVE_BYTECODE,
  POP_EVENT_BUS_BYTECODE, POP_LP_LOCKER_BYTECODE, POP_BONDING_FACTORY_BYTECODE,
} from "./bonding_bytecode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe"; // PopShiba protocol treasury

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const pk = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
    const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
    if (!pk || !rpc) throw new Error("Missing ETH_MAINNET_DEPLOYER_PRIVATE_KEY or ETH_MAINNET_RPC_URL");
    if (!BONDING_BYTECODE_READY) throw new Error("Bytecode not ready");

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dryRun = body.dryRun === true;
    const force = body.force === true;

    const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{64}$/.test(cleanedPk)) throw new Error("Invalid deployer private key format");
    const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);

    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

    // Look for existing active bonding deployment
    const { data: existingRows } = await supabase
      .from("bonding_deployments")
      .select("*")
      .eq("network", "mainnet")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false })
      .limit(1);
    const existing = existingRows?.[0] ?? null;

    const balance = await publicClient.getBalance({ address: account.address });

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        ready: balance > 50_000_000_000_000_000n, // ~0.05 ETH
        existing,
        canDeploy: !existing || force,
        treasury: TREASURY,
        immutables: { WETH9, UNI_V3_FACTORY, UNI_V3_POS_MGR },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (existing && !force) {
      return new Response(JSON.stringify({
        error: "Active bonding deployment already exists. Send { force: true } to redeploy.",
        existing,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sendDeploy = async (data: `0x${string}`, label: string) => {
      const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
      const predicted = getContractAddress({ from: account.address, nonce: BigInt(nonce) });
      const hash = await walletClient.sendTransaction({ to: null, data, nonce });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 240_000 });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${label} reverted: ${hash}`);
      const addr = getAddress(receipt.contractAddress);
      console.log(`[bonding-deploy] ${label} → ${addr} (${hash})`);
      // Sanity: predicted should match
      if (addr.toLowerCase() !== predicted.toLowerCase()) {
        console.warn(`[bonding-deploy] address mismatch ${label}: predicted ${predicted}, got ${addr}`);
      }
      return { addr, hash };
    };

    const txs: string[] = [];

    // 1. Token impl
    const tokenImpl = await sendDeploy(POP_BONDING_TOKEN_BYTECODE, "PopBondingToken");
    txs.push(tokenImpl.hash);

    // 2. Curve impl
    const curveImpl = await sendDeploy(POP_BONDING_CURVE_BYTECODE, "PopBondingCurve");
    txs.push(curveImpl.hash);

    // 3. EventBus
    const eventBus = await sendDeploy(POP_EVENT_BUS_BYTECODE, "PopEventBus");
    txs.push(eventBus.hash);

    // 4. LpLocker (constructor: weth, v3factory, v3posMgr, treasury)
    const lockerArgs = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
      [getAddress(WETH9), getAddress(UNI_V3_FACTORY), getAddress(UNI_V3_POS_MGR), getAddress(TREASURY)],
    );
    const lockerData = (POP_LP_LOCKER_BYTECODE + lockerArgs.slice(2)) as `0x${string}`;
    const lpLocker = await sendDeploy(lockerData, "PopLpLocker");
    txs.push(lpLocker.hash);

    // 5. Factory (constructor: tokenImpl, curveImpl, eventBus, lpLocker, treasury)
    const factoryArgs = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
      [tokenImpl.addr, curveImpl.addr, eventBus.addr, lpLocker.addr, getAddress(TREASURY)],
    );
    const factoryData = (POP_BONDING_FACTORY_BYTECODE + factoryArgs.slice(2)) as `0x${string}`;
    const factory = await sendDeploy(factoryData, "PopBondingFactory");
    txs.push(factory.hash);

    // 6. EventBus.setFactory(factory) — owner-only call from deployer
    const eventBusAbi = parseAbi(["function setFactory(address) external"]);
    const wireData = encodeFunctionData({ abi: eventBusAbi, functionName: "setFactory", args: [factory.addr] });
    const wireNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    const wireHash = await walletClient.sendTransaction({ to: eventBus.addr, data: wireData, nonce: wireNonce });
    const wireReceipt = await publicClient.waitForTransactionReceipt({ hash: wireHash, timeout: 240_000 });
    if (wireReceipt.status !== "success") throw new Error(`EventBus.setFactory reverted: ${wireHash}`);
    txs.push(wireHash);
    console.log(`[bonding-deploy] EventBus.setFactory(${factory.addr}) (${wireHash})`);

    // Mark previous active rows inactive
    await supabase.from("bonding_deployments").update({ is_active: false }).eq("network", "mainnet").eq("is_active", true);

    const { error: insertErr } = await supabase.from("bonding_deployments").insert({
      network: "mainnet",
      deployer: account.address,
      factory_address: factory.addr,
      token_impl_address: tokenImpl.addr,
      curve_impl_address: curveImpl.addr,
      event_bus_address: eventBus.addr,
      lp_locker_address: lpLocker.addr,
      treasury_address: TREASURY,
      tx_hashes: txs,
      is_active: true,
    });
    if (insertErr) console.error("[bonding-deploy] insert failed", insertErr);

    const finalBal = await publicClient.getBalance({ address: account.address });
    return new Response(JSON.stringify({
      success: true,
      deployer: account.address,
      contracts: {
        PopBondingFactory: factory.addr,
        PopBondingToken: tokenImpl.addr,
        PopBondingCurve: curveImpl.addr,
        PopEventBus: eventBus.addr,
        PopLpLocker: lpLocker.addr,
        Treasury: TREASURY,
      },
      tx_hashes: txs,
      gasUsedEth: formatEther(balance - finalBal),
      message: "✅ PopShiba bonding protocol deployed and wired.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bonding-deploy] FAIL:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
