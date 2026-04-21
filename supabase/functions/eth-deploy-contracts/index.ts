// PopShiba Ethereum Contract Suite — One-shot mainnet deployer.
// Compiles Solidity in-flight (npm:solc) → deploys Token impl, CloneFactory, FeeVault.
// Idempotent: refuses to redeploy if active row exists in eth_deployments.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "npm:viem@2.21.0";
import { privateKeyToAccount } from "npm:viem@2.21.0/accounts";
import { mainnet } from "npm:viem@2.21.0/chains";
import solc from "npm:solc@0.8.20";
import { POPSHIBA_TOKEN_SOL, POPSHIBA_CLONE_FACTORY_SOL, POPSHIBA_FEE_VAULT_SOL } from "./sources.ts";

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

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

  try {
    const balance = await publicClient.getBalance({ address: account.address });
    const nonce = await publicClient.getTransactionCount({ address: account.address });

    // Idempotency: check existing active deployment
    const { data: existing } = await supabase
      .from("eth_deployments")
      .select("id, vault_address, clone_factory_address, token_impl_address, deployed_at")
      .eq("is_active", true)
      .not("vault_address", "is", null)
      .not("clone_factory_address", "is", null)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        deployer: account.address,
        balance: `${formatEther(balance)} ETH`,
        nonce,
        ready: balance >= parseEther("0.05"),
        existingDeployment: existing ?? null,
        willDeploy: existing && !force
          ? []
          : ["PopShibaToken", "PopShibaCloneFactory", "PopShibaFeeVault"],
        warning: existing && !force ? "ACTIVE deployment already exists. Pass force=true to redeploy." : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (existing && !force) {
      return new Response(JSON.stringify({
        error: "Active PopShiba deployment already exists. Pass { force: true } to deploy a new set (deactivates the old one).",
        existing,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (balance < parseEther("0.05")) {
      return new Response(JSON.stringify({
        error: `Insufficient balance: ${formatEther(balance)} ETH. Need ≥0.05 ETH for gas.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Resume checkpoint: find any in-progress deploy by this deployer ----
    const { data: checkpoint } = await supabase
      .from("eth_deployment_progress")
      .select("id, token_impl_address, clone_factory_address, vault_address, tx_hashes")
      .eq("deployer", account.address)
      .eq("network", "mainnet")
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let progressId = checkpoint?.id ?? null;
    const txHashes: string[] = Array.isArray(checkpoint?.tx_hashes) ? [...checkpoint!.tx_hashes as string[]] : [];
    const deployed: Record<string, string> = {};
    if (checkpoint?.token_impl_address) deployed.PopShibaToken = checkpoint.token_impl_address;
    if (checkpoint?.clone_factory_address) deployed.PopShibaCloneFactory = checkpoint.clone_factory_address;
    if (checkpoint?.vault_address) deployed.PopShibaFeeVault = checkpoint.vault_address;

    if (!progressId) {
      const { data: newProg } = await supabase.from("eth_deployment_progress").insert({
        deployer: account.address,
        network: "mainnet",
        status: "in_progress",
        tx_hashes: [],
      }).select("id").single();
      progressId = newProg?.id ?? null;
    } else {
      console.log(`[deploy] Resuming checkpoint ${progressId}: have ${Object.keys(deployed).join(", ") || "none"}`);
    }

    // ---- Compile ----
    const out = compile({
      "PopShibaToken.sol": CONTRACT_SOURCES.PopShibaToken,
      "PopShibaCloneFactory.sol": CONTRACT_SOURCES.PopShibaCloneFactory,
      "PopShibaFeeVault.sol": CONTRACT_SOURCES.PopShibaFeeVault,
    });

    const tokenContract = out.contracts["PopShibaToken.sol"]["PopShibaToken"];
    const factoryContract = out.contracts["PopShibaCloneFactory.sol"]["PopShibaCloneFactory"];
    const vaultContract = out.contracts["PopShibaFeeVault.sol"]["PopShibaFeeVault"];

    // ABI encoder for constructor args (manual minimal — addresses only)
    const encodeAddr = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");

    async function deployOne(label: string, bytecode: string, ctorArgs: string = ""): Promise<string> {
      const data = `0x${bytecode}${ctorArgs}` as `0x${string}`;
      const hash = await walletClient.sendTransaction({ to: null, data, value: 0n });
      txHashes.push(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (!receipt.contractAddress) throw new Error(`${label} deploy: no contract address in receipt`);
      console.log(`[deploy] ${label} → ${receipt.contractAddress} (gas ${receipt.gasUsed})`);
      return receipt.contractAddress;
    }

    async function checkpointSave(field: "token_impl_address" | "clone_factory_address" | "vault_address", addr: string) {
      if (!progressId) return;
      await supabase.from("eth_deployment_progress").update({
        [field]: addr,
        tx_hashes: txHashes,
      }).eq("id", progressId);
    }

    try {
      // 1. PopShibaToken (impl, no ctor args)
      if (!deployed.PopShibaToken) {
        deployed.PopShibaToken = await deployOne("PopShibaToken", tokenContract.evm.bytecode.object);
        await checkpointSave("token_impl_address", deployed.PopShibaToken);
      } else {
        console.log(`[deploy] Skipping PopShibaToken — already deployed at ${deployed.PopShibaToken}`);
      }

      // 2. PopShibaCloneFactory(address implementation)
      if (!deployed.PopShibaCloneFactory) {
        deployed.PopShibaCloneFactory = await deployOne(
          "PopShibaCloneFactory",
          factoryContract.evm.bytecode.object,
          encodeAddr(deployed.PopShibaToken),
        );
        await checkpointSave("clone_factory_address", deployed.PopShibaCloneFactory);
      } else {
        console.log(`[deploy] Skipping PopShibaCloneFactory — already deployed at ${deployed.PopShibaCloneFactory}`);
      }

      // 3. PopShibaFeeVault(weth, nfpm, treasury)
      if (!deployed.PopShibaFeeVault) {
        deployed.PopShibaFeeVault = await deployOne(
          "PopShibaFeeVault",
          vaultContract.evm.bytecode.object,
          encodeAddr(WETH_MAINNET) + encodeAddr(UNISWAP_V3_NFPM) + encodeAddr(PLATFORM_TREASURY),
        );
        await checkpointSave("vault_address", deployed.PopShibaFeeVault);
      } else {
        console.log(`[deploy] Skipping PopShibaFeeVault — already deployed at ${deployed.PopShibaFeeVault}`);
      }
    } catch (deployErr) {
      const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
      if (progressId) {
        await supabase.from("eth_deployment_progress").update({
          status: "failed",
          last_error: msg,
          tx_hashes: txHashes,
        }).eq("id", progressId);
      }
      throw new Error(`Partial deploy failed (checkpoint saved, retry to resume): ${msg}`);
    }

    const finalBal = await publicClient.getBalance({ address: account.address });
    const gasUsedEth = formatEther(balance - finalBal);

    // Mark checkpoint completed
    if (progressId) {
      await supabase.from("eth_deployment_progress").update({
        status: "completed",
        tx_hashes: txHashes,
      }).eq("id", progressId);
    }

    // Deactivate prior rows + insert new active deployment
    await supabase.from("eth_deployments").update({ is_active: false }).eq("is_active", true);
    const { data: row, error: insErr } = await supabase.from("eth_deployments").insert({
      network: "mainnet",
      deployer: account.address,
      contracts: {
        PopShibaToken: deployed.PopShibaToken,
        PopShibaCloneFactory: deployed.PopShibaCloneFactory,
        PopShibaFeeVault: deployed.PopShibaFeeVault,
        weth: WETH_MAINNET,
        nfpm: UNISWAP_V3_NFPM,
        treasury: PLATFORM_TREASURY,
      },
      tx_hashes: txHashes,
      vault_address: deployed.PopShibaFeeVault,
      clone_factory_address: deployed.PopShibaCloneFactory,
      token_impl_address: deployed.PopShibaToken,
      is_active: true,
      verified: false,
    }).select().single();
    if (insErr) console.error("[deploy] persist failed", insErr);

    // Fire-and-forget verification
    EdgeRuntime.waitUntil((async () => {
      for (const [name, addr] of Object.entries(deployed)) {
        try {
          await supabase.functions.invoke("eth-verify-contract", {
            body: { address: addr, contractName: name },
          });
        } catch (e) { console.error(`[verify] ${name}:`, e); }
      }
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
