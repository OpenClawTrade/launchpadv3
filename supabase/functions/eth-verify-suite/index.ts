// Verifies all 4 PopShiba suite contracts (Token impl, CloneFactory, FeeVault, Launcher)
// on Etherscan. Source mirrors sources.ts of the deploy function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  POPSHIBA_TOKEN_SOL,
  POPSHIBA_CLONE_FACTORY_SOL,
  POPSHIBA_FEE_VAULT_SOL,
  POPSHIBA_LAUNCHER_SOL,
} from "../eth-deploy-contracts/sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAIN_ID = 1;
const COMPILER = "v0.8.20+commit.a1b79de6";
const PLATFORM_TREASURY = "0xF3298F1d7779f41f87B3ac8f610F3637611a2EAe";

interface ContractDef {
  file: string;
  name: string;
  source: string;
  ctorArgsHex: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function submit(addr: string, def: ContractDef, apiKey: string): Promise<{ ok: boolean; msg: string; guid?: string }> {
  const standardJson = {
    language: "Solidity",
    sources: { [def.file]: { content: def.source } },
    settings: {
      evmVersion: "paris",
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const form = new URLSearchParams();
  form.append("apikey", apiKey);
  form.append("module", "contract");
  form.append("action", "verifysourcecode");
  form.append("contractaddress", addr);
  form.append("sourceCode", JSON.stringify(standardJson));
  form.append("codeformat", "solidity-standard-json-input");
  form.append("contractname", `${def.file}:${def.name}`);
  form.append("compilerversion", COMPILER);
  form.append("constructorArguements", def.ctorArgsHex);

  const resp = await fetch(`https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}`, { method: "POST", body: form });
  const json = await resp.json();
  const result = String(json?.result ?? "");
  if (json?.status === "1") return { ok: true, msg: result, guid: result };
  if (/already verified/i.test(result)) return { ok: true, msg: "AlreadyVerified" };
  return { ok: false, msg: result };
}

async function poll(guid: string, apiKey: string): Promise<{ verified: boolean; msg: string }> {
  for (let i = 0; i < 20; i++) {
    await delay(6000);
    try {
      const r = await fetch(`https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`);
      const j = await r.json();
      const m = String(j?.result || "");
      if (/pass/i.test(m)) return { verified: true, msg: m };
      if (/fail/i.test(m) && !/pending/i.test(m)) return { verified: false, msg: m };
    } catch { /* retry */ }
  }
  return { verified: false, msg: "timeout" };
}

const encodeAddr = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ETHERSCAN_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch {}
  const deploymentId: string | undefined = body?.deploymentId;

  const { data: row } = deploymentId
    ? await supabase.from("eth_deployments").select("id, token_impl_address, clone_factory_address, vault_address, launcher_address").eq("id", deploymentId).maybeSingle()
    : await supabase.from("eth_deployments").select("id, token_impl_address, clone_factory_address, vault_address, launcher_address").eq("is_active", true).order("deployed_at", { ascending: false }).limit(1).maybeSingle();

  if (!row) {
    return new Response(JSON.stringify({ error: "No deployment found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenAddr = row.token_impl_address as string;
  const factoryAddr = row.clone_factory_address as string;
  const vaultAddr = row.vault_address as string;
  const launcherAddr = row.launcher_address as string | null;

  const factoryArgs = encodeAddr(tokenAddr);
  const vaultArgs = encodeAddr(PLATFORM_TREASURY);
  const launcherArgs = launcherAddr ? encodeAddr(factoryAddr) + encodeAddr(vaultAddr) : "";

  const defs: Array<{ addr: string; def: ContractDef }> = [
    { addr: tokenAddr, def: { file: "PopShibaToken.sol", name: "PopShibaToken", source: POPSHIBA_TOKEN_SOL, ctorArgsHex: "" } },
    { addr: factoryAddr, def: { file: "PopShibaCloneFactory.sol", name: "PopShibaCloneFactory", source: POPSHIBA_CLONE_FACTORY_SOL, ctorArgsHex: factoryArgs } },
    { addr: vaultAddr, def: { file: "PopShibaFeeVault.sol", name: "PopShibaFeeVault", source: POPSHIBA_FEE_VAULT_SOL, ctorArgsHex: vaultArgs } },
  ];
  if (launcherAddr) {
    defs.push({ addr: launcherAddr, def: { file: "PopShibaLauncher.sol", name: "PopShibaLauncher", source: POPSHIBA_LAUNCHER_SOL, ctorArgsHex: launcherArgs } });
  }

  const results: Record<string, any> = {};
  let allVerified = true;

  for (const { addr, def } of defs) {
    console.log(`[verify-suite] submitting ${def.name} @ ${addr}`);
    const sub = await submit(addr, def, apiKey);
    if (!sub.ok) {
      results[def.name] = { address: addr, verified: false, error: sub.msg };
      allVerified = false;
      console.warn(`[verify-suite] ${def.name} submit failed: ${sub.msg}`);
      await delay(2000);
      continue;
    }
    if (sub.msg === "AlreadyVerified") {
      results[def.name] = { address: addr, verified: true, alreadyVerified: true };
      await delay(2000);
      continue;
    }
    const polled = await poll(sub.guid!, apiKey);
    results[def.name] = { address: addr, verified: polled.verified, message: polled.msg, guid: sub.guid };
    if (!polled.verified) allVerified = false;
    await delay(2000);
  }

  if (allVerified) {
    await supabase.from("eth_deployments").update({ verified: true }).eq("id", row.id);
  }

  return new Response(JSON.stringify({
    success: true,
    deploymentId: row.id,
    allVerified,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
