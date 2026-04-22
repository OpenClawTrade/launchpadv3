// PopShiba Ethereum Contract Suite — One-shot mainnet deployer.
// Uses precompiled bytecode (no solc at runtime → fits in edge CPU budget).
// Idempotent: refuses to redeploy if active row exists in eth_deployments.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createWalletClient, createPublicClient, http, parseEther, formatEther, encodeFunctionData, parseAbi, getAddress } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import { POPSHIBA_LAUNCHER_BYTECODE } from "./launcher_bytecode.ts";
import {
  POPSHIBA_TOKEN_BYTECODE,
  POPSHIBA_CLONE_FACTORY_BYTECODE,
  POPSHIBA_FEE_VAULT_BYTECODE,
} from "./precompiled_bytecode.ts";
import {
  POPSHIBA_FEE_VAULT_V2_BYTECODE,
  POPSHIBA_LAUNCHER_V2_BYTECODE,
  V2_BYTECODE_READY,
} from "./v2_bytecode.ts";
import {
  POPSHIBA_FEE_VAULT_V3_BYTECODE,
  POPSHIBA_LAUNCHER_V3_BYTECODE,
  V3_BYTECODE_READY,
} from "./v3_bytecode.ts";
import { POPSHIBA_BURN_LAUNCHER_V2_BYTECODE } from "./v2burn_bytecode.ts";
import { compilePopShibaFeesLauncherV2 } from "./v2fees_compile.ts";

// V2-burn bytecode is always shipped (compiled in-tree). Treat as ready when non-empty.
const V2BURN_BYTECODE_READY = POPSHIBA_BURN_LAUNCHER_V2_BYTECODE.length > 4;
// V2-fees compiles in-flight via solc — always considered ready (the deploy step
// will surface a compile error if the source is broken).
const V2FEES_READY = true;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_V3_NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const PLATFORM_TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const pk = Deno.env.get("ETH_MAINNET_DEPLOYER_PRIVATE_KEY");
  const rpc = Deno.env.get("ETH_MAINNET_RPC_URL");
  if (!pk || !rpc) {
    return new Response(JSON.stringify({ error: "Missing ETH_MAINNET_DEPLOYER_PRIVATE_KEY or ETH_MAINNET_RPC_URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun: boolean = body.dryRun === true;
  const force: boolean = body.force === true;
  // launcherOnly: keep existing Token impl + CloneFactory + FeeVault, deploy ONLY the missing PopShibaLauncher and patch the active row.
  const launcherOnly: boolean = body.launcherOnly === true;
  // v2: deploy PopShibaFeeVaultV2 + PopShibaLauncherV2 (UNCX locking suite). Reuses existing
  // PopShibaToken impl + CloneFactory from the active V1 row, inserts a NEW active eth_deployments row.
  const v2: boolean = body.v2 === true;
  // v3: deploy PopShibaFeeVaultV3 + PopShibaLauncherV3 (Team Finance locking suite, optional lock).
  // Reuses existing PopShibaToken impl + CloneFactory; inserts NEW active row.
  const v3: boolean = body.v3 === true;
  // v2burn: deploy PopShibaBurnLauncherV2 (Uniswap V2, auto-burn LP, NO fees).
  // Reuses existing CloneFactory; no fee vault needed (LP is burned, no fees to collect).
  const v2burn: boolean = body.v2burn === true;
  // checkOwnership: read CloneFactory.owner() and FeeVault.owner() — needed to verify launcher can call gated funcs.
  const checkOwnership: boolean = body.checkOwnership === true;
  // transferOwnership: send 2 txs — CloneFactory.transferOwnership(launcher) + FeeVault.transferOwnership(launcher).
  // One-time setup; after this, ANY user wallet can call launcher.launch() and it works.
  const transferOwnership: boolean = body.transferOwnership === true;

  // Sanitize: strip whitespace, quotes, 0x prefix, then validate length
  const cleanedPk = pk.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(cleanedPk)) {
    return new Response(
      JSON.stringify({
        error: `Invalid ETH_MAINNET_DEPLOYER_PRIVATE_KEY format. Expected 64 hex chars (32 bytes), got ${cleanedPk.length} chars after sanitizing. Make sure you pasted the raw private key, not a mnemonic, JSON keystore, or address.`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const account = privateKeyToAccount(`0x${cleanedPk}` as `0x${string}`);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

  async function delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Helper: handle RPC nonce lag / overlapping requests by retrying with fresher or incremented nonces.
  async function sendTx(args: { to: `0x${string}` | null; data: `0x${string}`; value?: bigint }): Promise<`0x${string}`> {
    let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await walletClient.sendTransaction({ to: args.to, data: args.data, value: args.value ?? 0n, nonce });
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        const lower = msg.toLowerCase();
        const isNonceIssue = lower.includes("nonce too low") || lower.includes("nonce provided for the transaction") || lower.includes("replacement transaction underpriced") || lower.includes("already known");
        if (!isNonceIssue) throw error;

        const pendingNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
        const nextNonce = pendingNonce > nonce ? pendingNonce : nonce + 1;
        console.warn(`[deploy] nonce retry attempt=${attempt + 1} current=${nonce} pending=${pendingNonce} next=${nextNonce}`);
        nonce = nextNonce;
        await delay(400 * (attempt + 1));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  try {
    const balance = await publicClient.getBalance({ address: account.address });
    const nonce = await publicClient.getTransactionCount({ address: account.address });

    // Find any active row (with or without launcher) — filter in JS to avoid PostgREST .not() chain quirks.
    const { data: existingRows, error: exErr } = await supabase
      .from("eth_deployments")
      .select("id, vault_address, clone_factory_address, token_impl_address, launcher_address, deployed_at")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false });
    if (exErr) console.error("[deploy] fetch existing failed", exErr);
    const existing = (existingRows || []).find(
      (r) => r.token_impl_address && r.clone_factory_address && r.vault_address,
    ) || null;
    console.log("[deploy] existing row:", existing?.id, "launcher:", existing?.launcher_address);

    // Existing active row already has token+factory+vault but is missing launcher → user can do "launcher-only" patch.
    const canPatchLauncher = !!(existing && !existing.launcher_address &&
      existing.token_impl_address && existing.clone_factory_address && existing.vault_address);

    // ============= OWNERSHIP CHECK / TRANSFER =============
    // Read CloneFactory.owner() and FeeVault.owner(). Both must equal the Launcher address
    // for any user-wallet launch to succeed (createToken / registerToken are onlyOwner).
    const ownableAbi = parseAbi([
      "function owner() view returns (address)",
      "function transferOwnership(address newOwner) external",
    ]);

    async function readOwners() {
      if (!existing?.clone_factory_address || !existing?.vault_address) {
        return { factoryOwner: null, vaultOwner: null };
      }
      try {
        const [factoryOwner, vaultOwner] = await Promise.all([
          publicClient.readContract({
            address: getAddress(existing.clone_factory_address),
            abi: ownableAbi,
            functionName: "owner",
          }) as Promise<string>,
          publicClient.readContract({
            address: getAddress(existing.vault_address),
            abi: ownableAbi,
            functionName: "owner",
          }) as Promise<string>,
        ]);
        return { factoryOwner, vaultOwner };
      } catch (e) {
        console.error("[ownership] read failed", e);
        return { factoryOwner: null, vaultOwner: null };
      }
    }

    if (checkOwnership) {
      if (!existing) {
        return new Response(JSON.stringify({ error: "No active deployment to inspect" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { factoryOwner, vaultOwner } = await readOwners();
      const launcher = existing.launcher_address;
      const factoryOk = !!(factoryOwner && launcher && factoryOwner.toLowerCase() === launcher.toLowerCase());
      const vaultOk = !!(vaultOwner && launcher && vaultOwner.toLowerCase() === launcher.toLowerCase());
      return new Response(JSON.stringify({
        success: true,
        deployer: account.address,
        launcher,
        factoryAddress: existing.clone_factory_address,
        vaultAddress: existing.vault_address,
        factoryOwner,
        vaultOwner,
        factoryOk,
        vaultOk,
        bothOk: factoryOk && vaultOk,
        message: factoryOk && vaultOk
          ? "✅ Both contracts owned by the Launcher. User wallets can launch tokens."
          : "⚠️ Ownership not transferred yet. Click 'Hand Over Ownership' to enable user launches.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (transferOwnership) {
      if (!existing?.launcher_address || !existing?.clone_factory_address || !existing?.vault_address) {
        return new Response(JSON.stringify({ error: "Active deployment must have launcher + factory + vault" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const launcher = getAddress(existing.launcher_address);
      const factory = getAddress(existing.clone_factory_address);
      const vault = getAddress(existing.vault_address);

      const { factoryOwner, vaultOwner } = await readOwners();
      const txs: { contract: string; tx: string; alreadyTransferred?: boolean }[] = [];

      // Factory
      if (factoryOwner && factoryOwner.toLowerCase() === launcher.toLowerCase()) {
        txs.push({ contract: "CloneFactory", tx: "", alreadyTransferred: true });
      } else if (factoryOwner && factoryOwner.toLowerCase() !== account.address.toLowerCase()) {
        return new Response(JSON.stringify({
          error: `CloneFactory owner is ${factoryOwner} — not the deployer wallet ${account.address}. Cannot transfer.`,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const data = encodeFunctionData({ abi: ownableAbi, functionName: "transferOwnership", args: [launcher] });
        const hash = await sendTx({ to: factory, data, value: 0n });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (receipt.status !== "success") throw new Error(`CloneFactory.transferOwnership reverted: ${hash}`);
        txs.push({ contract: "CloneFactory", tx: hash });
        console.log(`[ownership] CloneFactory → Launcher (${hash})`);
      }

      // Vault
      if (vaultOwner && vaultOwner.toLowerCase() === launcher.toLowerCase()) {
        txs.push({ contract: "FeeVault", tx: "", alreadyTransferred: true });
      } else if (vaultOwner && vaultOwner.toLowerCase() !== account.address.toLowerCase()) {
        return new Response(JSON.stringify({
          error: `FeeVault owner is ${vaultOwner} — not the deployer wallet ${account.address}. Cannot transfer.`,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const data = encodeFunctionData({ abi: ownableAbi, functionName: "transferOwnership", args: [launcher] });
        const hash = await sendTx({ to: vault, data, value: 0n });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (receipt.status !== "success") throw new Error(`FeeVault.transferOwnership reverted: ${hash}`);
        txs.push({ contract: "FeeVault", tx: hash });
        console.log(`[ownership] FeeVault → Launcher (${hash})`);
      }

      const finalBalOwn = await publicClient.getBalance({ address: account.address });
      return new Response(JSON.stringify({
        success: true,
        mode: "transfer-ownership",
        deployer: account.address,
        launcher,
        txs,
        gasUsedEth: formatEther(balance - finalBalOwn),
        message: "✅ Ownership transferred. Any user wallet can now call launcher.launch() and become the token creator.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      const willDeploy = launcherOnly
        ? (canPatchLauncher ? ["PopShibaLauncher"] : [])
        : (existing && !force ? [] : ["PopShibaToken", "PopShibaCloneFactory", "PopShibaFeeVault", "PopShibaLauncher"]);

      // Include ownership status when an active deployment with launcher exists.
      let ownership: any = null;
      if (existing?.launcher_address) {
        const { factoryOwner, vaultOwner } = await readOwners();
        const launcher = existing.launcher_address;
        const factoryOk = !!(factoryOwner && factoryOwner.toLowerCase() === launcher.toLowerCase());
        const vaultOk = !!(vaultOwner && vaultOwner.toLowerCase() === launcher.toLowerCase());
        ownership = { factoryOwner, vaultOwner, factoryOk, vaultOk, bothOk: factoryOk && vaultOk };
      }

      return new Response(JSON.stringify({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        nonce,
        ready: balance >= parseEther(launcherOnly ? "0.01" : "0.005"),
        existingDeployment: existing ?? null,
        canPatchLauncher,
        willDeploy,
        ownership,
        v2Ready: V2_BYTECODE_READY,
        v2CanDeploy: V2_BYTECODE_READY && !!(existing?.token_impl_address && existing?.clone_factory_address),
        v3Ready: V3_BYTECODE_READY,
        v3CanDeploy: V3_BYTECODE_READY && !!(existing?.token_impl_address && existing?.clone_factory_address),
        v2burnReady: V2BURN_BYTECODE_READY,
        v2burnCanDeploy: V2BURN_BYTECODE_READY && !!existing?.clone_factory_address,
        warning: launcherOnly && !canPatchLauncher
          ? "Cannot patch: no active row with token/factory/vault but missing launcher."
          : (existing && !force && !launcherOnly && !v2 && !v3 && !v2burn ? "ACTIVE deployment already exists. Pass force=true to redeploy, launcherOnly=true to add the missing Launcher, v2=true for UNCX-lock suite, v3=true for Team Finance-lock suite, or v2burn=true for fee-free V2 burn launcher." : null),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // V2 DEPLOY MODE — UNCX locking suite
    //   1. Reuses existing PopShibaToken impl + CloneFactory from V1 active row.
    //   2. Deploys PopShibaFeeVaultV2 (treasury) + PopShibaLauncherV2 (factory, vaultV2).
    //   3. Calls FeeVaultV2.setLauncher(launcherV2) so registerLockedToken works.
    //   4. Inserts a NEW active eth_deployments row (deactivates V1 row → frontend
    //      automatically routes new launches to V2). V1 row stays usable for legacy claims.
    // ============================================================
    if (v2) {
      if (!V2_BYTECODE_READY) {
        return new Response(JSON.stringify({
          error: "V2 bytecode not pasted yet. Compile contracts/PopShibaFeeVaultV2.sol + PopShibaLauncherV2.sol (Solidity 0.8.20, optimizer 200 runs) and paste the runtime bytecode into supabase/functions/eth-deploy-contracts/v2_bytecode.ts.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!existing?.token_impl_address || !existing?.clone_factory_address) {
        return new Response(JSON.stringify({
          error: "V2 deploy requires an existing V1 active row (for the shared PopShibaToken impl + CloneFactory). Deploy V1 first.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (balance < parseEther("0.02")) {
        return new Response(JSON.stringify({
          error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.02 ETH for V2 deploy.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const encodeAddrLocal = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");
      const v2TxHashes: string[] = [];

      async function deployOneV2(label: string, bytecode: string, ctorArgs: string = ""): Promise<string> {
        const data = `0x${bytecode}${ctorArgs}` as `0x${string}`;
        const hash = await sendTx({ to: null, data, value: 0n });
        v2TxHashes.push(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (!receipt.contractAddress) throw new Error(`${label} deploy: no contract address in receipt`);
        console.log(`[deploy v2] ${label} → ${receipt.contractAddress} (gas ${receipt.gasUsed})`);
        return receipt.contractAddress;
      }

      // 1. PopShibaFeeVaultV2(treasury)
      const vaultV2 = await deployOneV2(
        "PopShibaFeeVaultV2",
        POPSHIBA_FEE_VAULT_V2_BYTECODE,
        encodeAddrLocal(PLATFORM_TREASURY),
      );

      // 2. PopShibaLauncherV2(cloneFactory, vaultV2)
      const launcherV2 = await deployOneV2(
        "PopShibaLauncherV2",
        POPSHIBA_LAUNCHER_V2_BYTECODE,
        encodeAddrLocal(existing.clone_factory_address) + encodeAddrLocal(vaultV2),
      );

      // 3. Wire FeeVaultV2.setLauncher(launcherV2) — required so registerLockedToken() works.
      const setLauncherAbi = parseAbi(["function setLauncher(address) external"]);
      const setLauncherTx = await sendTx({
        to: getAddress(vaultV2),
        data: encodeFunctionData({ abi: setLauncherAbi, functionName: "setLauncher", args: [getAddress(launcherV2)] }),
        value: 0n,
      });
      v2TxHashes.push(setLauncherTx);
      const setLauncherReceipt = await publicClient.waitForTransactionReceipt({ hash: setLauncherTx, timeout: 180_000 });
      if (setLauncherReceipt.status !== "success") throw new Error(`setLauncher reverted: ${setLauncherTx}`);

      // 4. Read uncxLockFeeWei from launcher so we can persist it (no need for client to query).
      let uncxLockFeeWei: string | null = null;
      try {
        const fee = await publicClient.readContract({
          address: getAddress(launcherV2),
          abi: parseAbi(["function uncxLockFeeWei() view returns (uint256)"]),
          functionName: "uncxLockFeeWei",
        }) as bigint;
        uncxLockFeeWei = fee.toString();
      } catch (e) {
        console.warn("[deploy v2] uncxLockFeeWei read failed (will fall back to 0.0001 ETH):", e);
      }

      const finalBalV2 = await publicClient.getBalance({ address: account.address });

      // Deactivate prior rows + insert new active V2 row.
      await supabase.from("eth_deployments").update({ is_active: false }).eq("is_active", true);
      const { data: rowV2, error: insErrV2 } = await supabase.from("eth_deployments").insert({
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaToken: existing.token_impl_address,
          PopShibaCloneFactory: existing.clone_factory_address,
          PopShibaFeeVaultV2: vaultV2,
          PopShibaLauncherV2: launcherV2,
          weth: WETH_MAINNET,
          nfpm: UNISWAP_V3_NFPM,
          uncx_v3_locker: "0xFD235968e65B0990584585763f837A5b5330e6DE",
          treasury: PLATFORM_TREASURY,
          version: "v2",
        },
        tx_hashes: v2TxHashes,
        vault_address: vaultV2,
        clone_factory_address: existing.clone_factory_address,
        token_impl_address: existing.token_impl_address,
        launcher_address: launcherV2,
        uncx_lock_fee_wei: uncxLockFeeWei,
        is_active: true,
        verified: false,
      }).select().single();
      if (insErrV2) console.error("[deploy v2] persist failed", insErrV2);

      return new Response(JSON.stringify({
        success: true,
        mode: "v2",
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaToken: existing.token_impl_address,
          PopShibaCloneFactory: existing.clone_factory_address,
          PopShibaFeeVaultV2: vaultV2,
          PopShibaLauncherV2: launcherV2,
        },
        tx_hashes: v2TxHashes,
        gasUsedEth: formatEther(balance - finalBalV2),
        uncxLockFeeWei,
        deploymentId: rowV2?.id,
        message: "✅ V2 (UNCX locking) suite deployed. New launches will use UNCX V3 Locker. V1 vault stays operational for legacy claims.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // V3 DEPLOY MODE — Team Finance locking suite (optional lock)
    //   1. Reuses existing PopShibaToken impl + CloneFactory.
    //   2. Deploys PopShibaFeeVaultV3 (Team Finance-aware) + PopShibaLauncherV3.
    //   3. Calls FeeVaultV3.setLauncher(launcherV3) so registerLockedToken works.
    //   4. Inserts NEW active eth_deployments row → frontend routes new launches to V3.
    // ============================================================
    if (v3) {
      if (!V3_BYTECODE_READY) {
        return new Response(JSON.stringify({
          error: "V3 bytecode not pasted yet. Compile contracts/PopShibaFeeVaultV3.sol + PopShibaLauncherV3.sol (Solidity 0.8.20, optimizer 200 runs, viaIR) and paste the runtime bytecode into supabase/functions/eth-deploy-contracts/v3_bytecode.ts.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!existing?.token_impl_address || !existing?.clone_factory_address) {
        return new Response(JSON.stringify({
          error: "V3 deploy requires an existing active row (for the shared PopShibaToken impl + CloneFactory). Deploy V1 first.",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (balance < parseEther("0.02")) {
        return new Response(JSON.stringify({
          error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.02 ETH for V3 deploy.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const encodeAddrLocal3 = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");
      const v3TxHashes: string[] = [];

      async function deployOneV3(label: string, bytecode: string, ctorArgs: string = ""): Promise<string> {
        const data = `0x${bytecode}${ctorArgs}` as `0x${string}`;
        const hash = await sendTx({ to: null, data, value: 0n });
        v3TxHashes.push(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (!receipt.contractAddress) throw new Error(`${label} deploy: no contract address in receipt`);
        console.log(`[deploy v3] ${label} → ${receipt.contractAddress} (gas ${receipt.gasUsed})`);
        return receipt.contractAddress;
      }

      // 1. PopShibaFeeVaultV3(treasury)
      const vaultV3 = await deployOneV3(
        "PopShibaFeeVaultV3",
        POPSHIBA_FEE_VAULT_V3_BYTECODE,
        encodeAddrLocal3(PLATFORM_TREASURY),
      );

      // 2. PopShibaLauncherV3(cloneFactory, vaultV3)
      const launcherV3 = await deployOneV3(
        "PopShibaLauncherV3",
        POPSHIBA_LAUNCHER_V3_BYTECODE,
        encodeAddrLocal3(existing.clone_factory_address) + encodeAddrLocal3(vaultV3),
      );

      // 3. Wire FeeVaultV3.setLauncher(launcherV3)
      const setLauncherAbi3 = parseAbi(["function setLauncher(address) external"]);
      const setLauncherTx3 = await sendTx({
        to: getAddress(vaultV3),
        data: encodeFunctionData({ abi: setLauncherAbi3, functionName: "setLauncher", args: [getAddress(launcherV3)] }),
        value: 0n,
      });
      v3TxHashes.push(setLauncherTx3);
      const setLauncherReceipt3 = await publicClient.waitForTransactionReceipt({ hash: setLauncherTx3, timeout: 180_000 });
      if (setLauncherReceipt3.status !== "success") throw new Error(`setLauncher reverted: ${setLauncherTx3}`);

      // 4. Read teamFinanceFeeWei from launcher (live from Team Finance price oracle).
      let tfLockFeeWei: string | null = null;
      try {
        const fee = await publicClient.readContract({
          address: getAddress(launcherV3),
          abi: parseAbi(["function teamFinanceFeeWei() view returns (uint256)"]),
          functionName: "teamFinanceFeeWei",
        }) as bigint;
        tfLockFeeWei = fee.toString();
      } catch (e) {
        console.warn("[deploy v3] teamFinanceFeeWei read failed:", e);
      }

      const finalBalV3 = await publicClient.getBalance({ address: account.address });

      await supabase.from("eth_deployments").update({ is_active: false }).eq("is_active", true);
      const { data: rowV3, error: insErrV3 } = await supabase.from("eth_deployments").insert({
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaToken: existing.token_impl_address,
          PopShibaCloneFactory: existing.clone_factory_address,
          PopShibaFeeVaultV3: vaultV3,
          PopShibaLauncherV3: launcherV3,
          weth: WETH_MAINNET,
          nfpm: UNISWAP_V3_NFPM,
          team_finance_locker: "0xE2fE530C047f2d85298b07D9333C05737f1435fB",
          treasury: PLATFORM_TREASURY,
          version: "v3",
          locker: "team_finance",
        },
        tx_hashes: v3TxHashes,
        vault_address: vaultV3,
        clone_factory_address: existing.clone_factory_address,
        token_impl_address: existing.token_impl_address,
        launcher_address: launcherV3,
        uncx_lock_fee_wei: tfLockFeeWei, // reused column — now stores Team Finance fee
        is_active: true,
        verified: false,
      }).select().single();
      if (insErrV3) console.error("[deploy v3] persist failed", insErrV3);

      return new Response(JSON.stringify({
        success: true,
        mode: "v3",
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaToken: existing.token_impl_address,
          PopShibaCloneFactory: existing.clone_factory_address,
          PopShibaFeeVaultV3: vaultV3,
          PopShibaLauncherV3: launcherV3,
        },
        tx_hashes: v3TxHashes,
        gasUsedEth: formatEther(balance - finalBalV3),
        tfLockFeeWei,
        deploymentId: rowV3?.id,
        message: "✅ V3 (Team Finance locking) suite deployed. New launches can opt into LP locking per-launch (cheap default = no lock).",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // V2-BURN DEPLOY MODE — fully standalone, fee-free V2 launcher with auto-burn LP
    //   1. Deploys PopShibaBurnLauncherV2() with NO constructor args.
    //   2. Standalone: deploys its own ERC20 inline, no CloneFactory dependency,
    //      zero shared state with V3 — V3 launches keep working untouched.
    //   3. Inserts a NEW eth_deployments row tagged version="v2burn" alongside
    //      existing V3 row (V3 row stays active too — frontend picks by version).
    // ============================================================
    if (v2burn) {
      if (!V2BURN_BYTECODE_READY) {
        return new Response(JSON.stringify({
          error: "V2-burn bytecode missing from v2burn_bytecode.ts. Recompile contracts/PopShibaBurnLauncherV2.sol.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (balance < parseEther("0.005")) {
        return new Response(JSON.stringify({
          error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.005 ETH for V2-burn deploy.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const burnTxHashes: string[] = [];

      // Single-contract deploy: PopShibaBurnLauncherV2() — no constructor args.
      const burnLauncherData = `0x${POPSHIBA_BURN_LAUNCHER_V2_BYTECODE.replace(/^0x/, "")}` as `0x${string}`;
      const burnHash = await sendTx({ to: null, data: burnLauncherData, value: 0n });
      burnTxHashes.push(burnHash);
      const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: burnHash, timeout: 180_000 });
      if (!burnReceipt.contractAddress) throw new Error("V2-burn launcher deploy: no contract address in receipt");
      const burnLauncher = burnReceipt.contractAddress;
      console.log(`[deploy v2burn] PopShibaBurnLauncherV2 → ${burnLauncher} (gas ${burnReceipt.gasUsed})`);

      const finalBalBurn = await publicClient.getBalance({ address: account.address });

      // IMPORTANT: do NOT deactivate the existing V3 row. We want both V3 and V2-burn
      // rows active simultaneously. Frontend selects by version field.
      const { data: rowBurn, error: insErrBurn } = await supabase.from("eth_deployments").insert({
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaBurnLauncherV2: burnLauncher,
          weth: WETH_MAINNET,
          v2_router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          v2_factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
          treasury: PLATFORM_TREASURY,
          version: "v2burn",
          locker: "burn",
        },
        tx_hashes: burnTxHashes,
        vault_address: burnLauncher,            // schema requires NOT NULL — burn launcher is its own "vault"
        clone_factory_address: burnLauncher,    // schema requires NOT NULL — standalone, points to itself
        token_impl_address: burnLauncher,       // schema requires NOT NULL — inline ERC20, no impl
        launcher_address: burnLauncher,
        uncx_lock_fee_wei: "0",
        is_active: true,
        verified: false,
      }).select().single();
      if (insErrBurn) console.error("[deploy v2burn] persist failed", insErrBurn);

      return new Response(JSON.stringify({
        success: true,
        mode: "v2burn",
        network: "mainnet",
        deployer: account.address,
        contracts: { PopShibaBurnLauncherV2: burnLauncher },
        tx_hashes: burnTxHashes,
        gasUsedEth: formatEther(balance - finalBalBurn),
        deploymentId: rowBurn?.id,
        message: "✅ V2-burn launcher deployed. Pure fair-launch, no fees, auto-burn LP — all aggregator green checkmarks. V3 launcher untouched.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    if (launcherOnly) {
      if (!canPatchLauncher) {
        return new Response(JSON.stringify({
          error: "launcherOnly requires an active deployment with token+factory+vault but no launcher_address. Current state doesn't match.",
          existing,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (balance < parseEther("0.01")) {
        return new Response(JSON.stringify({
          error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.01 ETH for launcher-only deploy.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (existing && !force) {
      return new Response(JSON.stringify({
        error: "Active PopShiba deployment already exists. Pass { launcherOnly: true } to add only the missing Launcher (recommended), or { force: true } to redeploy ALL contracts (deactivates the old set).",
        existing,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (balance < parseEther("0.005")) {
      return new Response(JSON.stringify({
        error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.005 ETH for full deploy.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const encodeAddr = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");
    const txHashes: string[] = [];
    const deployed: Record<string, string> = {};

    async function deployOne(label: string, bytecode: string, ctorArgs: string = ""): Promise<string> {
      const data = `0x${bytecode}${ctorArgs}` as `0x${string}`;
      const hash = await sendTx({ to: null, data, value: 0n });
      txHashes.push(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (!receipt.contractAddress) throw new Error(`${label} deploy: no contract address in receipt`);
      console.log(`[deploy] ${label} → ${receipt.contractAddress} (gas ${receipt.gasUsed})`);
      return receipt.contractAddress;
    }

    // ============= LAUNCHER-ONLY MODE: use precompiled bytecode (skips solc → no CPU limit) =============
    if (launcherOnly && existing) {
      const launcherAddr = await deployOne(
        "PopShibaLauncher",
        POPSHIBA_LAUNCHER_BYTECODE,
        encodeAddr(existing.clone_factory_address!) + encodeAddr(existing.vault_address!),
      );


      const finalBalLO = await publicClient.getBalance({ address: account.address });
      const gasUsedEthLO = formatEther(balance - finalBalLO);

      // Patch the existing active row — DO NOT deactivate it, DO NOT touch the other 3 addresses.
      const { error: updErr } = await supabase
        .from("eth_deployments")
        .update({
          launcher_address: launcherAddr,
          contracts: {
            PopShibaToken: existing.token_impl_address,
            PopShibaCloneFactory: existing.clone_factory_address,
            PopShibaFeeVault: existing.vault_address,
            PopShibaLauncher: launcherAddr,
            weth: WETH_MAINNET,
            nfpm: UNISWAP_V3_NFPM,
            treasury: PLATFORM_TREASURY,
          },
          tx_hashes: txHashes,
          verified: false,
        })
        .eq("id", existing.id);
      if (updErr) console.error("[deploy launcher-only] patch failed", updErr);

      // Verify just the launcher in background
      EdgeRuntime.waitUntil((async () => {
        try {
          await supabase.functions.invoke("eth-verify-suite", {
            body: { deploymentId: existing.id, only: ["PopShibaLauncher"] },
          });
        } catch (e) { console.error("[verify-suite] invoke failed:", e); }
      })());

      return new Response(JSON.stringify({
        success: true,
        mode: "launcher-only",
        network: "mainnet",
        deployer: account.address,
        contracts: {
          PopShibaToken: existing.token_impl_address,
          PopShibaCloneFactory: existing.clone_factory_address,
          PopShibaFeeVault: existing.vault_address,
          PopShibaLauncher: launcherAddr,
        },
        tx_hashes: txHashes,
        gasUsedEth: gasUsedEthLO,
        deploymentId: existing.id,
        message: "✅ Launcher deployed and wired to existing 3 contracts. The previous 3 contracts are untouched & still verified.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Full deploy uses precompiled bytecode (no solc at runtime → fits CPU budget) ----

    // 1. PopShibaToken (impl)
    deployed.PopShibaToken = await deployOne("PopShibaToken", POPSHIBA_TOKEN_BYTECODE);

    // 2. PopShibaCloneFactory(implementation)
    deployed.PopShibaCloneFactory = await deployOne(
      "PopShibaCloneFactory",
      POPSHIBA_CLONE_FACTORY_BYTECODE,
      encodeAddr(deployed.PopShibaToken),
    );

    // 3. PopShibaFeeVault(treasury)
    deployed.PopShibaFeeVault = await deployOne(
      "PopShibaFeeVault",
      POPSHIBA_FEE_VAULT_BYTECODE,
      encodeAddr(PLATFORM_TREASURY),
    );

    // 4. PopShibaLauncher(cloneFactory, feeVault)
    deployed.PopShibaLauncher = await deployOne(
      "PopShibaLauncher",
      POPSHIBA_LAUNCHER_BYTECODE,
      encodeAddr(deployed.PopShibaCloneFactory) + encodeAddr(deployed.PopShibaFeeVault),
    );

    const finalBal = await publicClient.getBalance({ address: account.address });
    const gasUsedEth = formatEther(balance - finalBal);

    // Deactivate prior rows + insert new active deployment
    await supabase.from("eth_deployments").update({ is_active: false }).eq("is_active", true);
    const { data: row, error: insErr } = await supabase.from("eth_deployments").insert({
      network: "mainnet",
      deployer: account.address,
      contracts: {
        PopShibaToken: deployed.PopShibaToken,
        PopShibaCloneFactory: deployed.PopShibaCloneFactory,
        PopShibaFeeVault: deployed.PopShibaFeeVault,
        PopShibaLauncher: deployed.PopShibaLauncher,
        weth: WETH_MAINNET,
        nfpm: UNISWAP_V3_NFPM,
        treasury: PLATFORM_TREASURY,
      },
      tx_hashes: txHashes,
      vault_address: deployed.PopShibaFeeVault,
      clone_factory_address: deployed.PopShibaCloneFactory,
      token_impl_address: deployed.PopShibaToken,
      launcher_address: deployed.PopShibaLauncher,
      is_active: true,
      verified: false,
    }).select().single();
    if (insErr) console.error("[deploy] persist failed", insErr);

    // Fire-and-forget verification of all 4 suite contracts
    EdgeRuntime.waitUntil((async () => {
      try {
        await supabase.functions.invoke("eth-verify-suite", {
          body: { deploymentId: row?.id },
        });
      } catch (e) { console.error("[verify-suite] invoke failed:", e); }
    })());

    return new Response(JSON.stringify({
      success: true,
      network: "mainnet",
      deployer: account.address,
      contracts: deployed,
      tx_hashes: txHashes,
      gasUsedEth,
      deploymentId: row?.id,
      message: "✅ Deployed. Etherscan verification running in background.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[eth-deploy-contracts] FAIL:", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
