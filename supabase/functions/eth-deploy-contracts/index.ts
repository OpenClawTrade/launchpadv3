// PopShiba Ethereum Contract Suite — One-shot mainnet deployer.
// Compiles Solidity in-flight (npm:solc) → deploys Token impl, CloneFactory, FeeVault, Launcher.
// Idempotent: refuses to redeploy if active row exists in eth_deployments.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import solc from "npm:solc@0.8.20";
import {
  POPSHIBA_TOKEN_SOL,
  POPSHIBA_CLONE_FACTORY_SOL,
  POPSHIBA_FEE_VAULT_SOL,
  POPSHIBA_LAUNCHER_SOL,
} from "./sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_V3_NFPM = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const PLATFORM_TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe";

const CONTRACT_SOURCES: Record<string, string> = {
  PopShibaToken: POPSHIBA_TOKEN_SOL,
  PopShibaCloneFactory: POPSHIBA_CLONE_FACTORY_SOL,
  PopShibaFeeVault: POPSHIBA_FEE_VAULT_SOL,
  PopShibaLauncher: POPSHIBA_LAUNCHER_SOL,
};

function compile(sources: Record<string, string>) {
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some((e: any) => e.severity === "error")) {
    throw new Error("Compile failed: " + output.errors.map((e: any) => e.formattedMessage).join("\n"));
  }
  return output;
}

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

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

  try {
    const balance = await publicClient.getBalance({ address: account.address });
    const nonce = await publicClient.getTransactionCount({ address: account.address });

    // Idempotency: only consider "fully-formed" active deployments (must have launcher_address now)
    const { data: existing } = await supabase
      .from("eth_deployments")
      .select("id, vault_address, clone_factory_address, token_impl_address, launcher_address, deployed_at")
      .eq("is_active", true)
      .not("vault_address", "is", null)
      .not("clone_factory_address", "is", null)
      .not("launcher_address", "is", null)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Existing active row already has token+factory+vault but is missing launcher → user can do "launcher-only" patch.
    const canPatchLauncher = !!(existing && !existing.launcher_address &&
      existing.token_impl_address && existing.clone_factory_address && existing.vault_address);

    if (dryRun) {
      const willDeploy = launcherOnly
        ? (canPatchLauncher ? ["PopShibaLauncher"] : [])
        : (existing && !force ? [] : ["PopShibaToken", "PopShibaCloneFactory", "PopShibaFeeVault", "PopShibaLauncher"]);
      return new Response(JSON.stringify({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        nonce,
        ready: balance >= parseEther(launcherOnly ? "0.01" : "0.05"),
        existingDeployment: existing ?? null,
        canPatchLauncher,
        willDeploy,
        warning: launcherOnly && !canPatchLauncher
          ? "Cannot patch: no active row with token/factory/vault but missing launcher."
          : (existing && !force && !launcherOnly ? "ACTIVE deployment already exists. Pass force=true to redeploy or launcherOnly=true to add the missing Launcher." : null),
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
    } else if (balance < parseEther("0.05")) {
      return new Response(JSON.stringify({
        error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.05 ETH for full deploy.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Compile ----
    const out = compile({
      "PopShibaToken.sol": CONTRACT_SOURCES.PopShibaToken,
      "PopShibaCloneFactory.sol": CONTRACT_SOURCES.PopShibaCloneFactory,
      "PopShibaFeeVault.sol": CONTRACT_SOURCES.PopShibaFeeVault,
      "PopShibaLauncher.sol": CONTRACT_SOURCES.PopShibaLauncher,
    });

    const tokenContract = out.contracts["PopShibaToken.sol"]["PopShibaToken"];
    const factoryContract = out.contracts["PopShibaCloneFactory.sol"]["PopShibaCloneFactory"];
    const vaultContract = out.contracts["PopShibaFeeVault.sol"]["PopShibaFeeVault"];
    const launcherContract = out.contracts["PopShibaLauncher.sol"]["PopShibaLauncher"];

    const encodeAddr = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");
    const txHashes: string[] = [];
    const deployed: Record<string, string> = {};

    async function deployOne(label: string, bytecode: string, ctorArgs: string = ""): Promise<string> {
      const data = `0x${bytecode}${ctorArgs}` as `0x${string}`;
      const hash = await walletClient.sendTransaction({ to: null, data, value: 0n });
      txHashes.push(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (!receipt.contractAddress) throw new Error(`${label} deploy: no contract address in receipt`);
      console.log(`[deploy] ${label} → ${receipt.contractAddress} (gas ${receipt.gasUsed})`);
      return receipt.contractAddress;
    }

    // ============= LAUNCHER-ONLY MODE: keep existing 3 contracts, deploy ONLY the missing PopShibaLauncher =============
    if (launcherOnly && existing) {
      const launcherAddr = await deployOne(
        "PopShibaLauncher",
        launcherContract.evm.bytecode.object,
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

    // 1. PopShibaToken (impl)
    deployed.PopShibaToken = await deployOne("PopShibaToken", tokenContract.evm.bytecode.object);

    // 2. PopShibaCloneFactory(implementation)
    deployed.PopShibaCloneFactory = await deployOne(
      "PopShibaCloneFactory",
      factoryContract.evm.bytecode.object,
      encodeAddr(deployed.PopShibaToken),
    );

    // 3. PopShibaFeeVault(treasury)
    deployed.PopShibaFeeVault = await deployOne(
      "PopShibaFeeVault",
      vaultContract.evm.bytecode.object,
      encodeAddr(PLATFORM_TREASURY),
    );

    // 4. PopShibaLauncher(cloneFactory, feeVault)
    deployed.PopShibaLauncher = await deployOne(
      "PopShibaLauncher",
      launcherContract.evm.bytecode.object,
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
