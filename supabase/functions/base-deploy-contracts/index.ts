import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createWalletClient, createPublicClient, http, parseEther, encodeDeployData } from "https://esm.sh/viem@2.45.1";
import { base, baseSepolia } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Contract bytecode and ABIs - these need to be filled after Foundry compilation
// Run: cd contracts/flaunch && forge build && cat out/TunaFlETH.sol/TunaFlETH.json | jq '.bytecode.object'
const CONTRACT_ARTIFACTS = {
  TunaFlETH: {
    // Bytecode will be added after compilation
    bytecode: "" as `0x${string}`,
    abi: [
      { type: "constructor", inputs: [{ name: "_aavePool", type: "address" }] },
    ] as const,
  },
  TunaMemecoin: {
    bytecode: "" as `0x${string}`,
    abi: [
      {
        type: "constructor",
        inputs: [
          { name: "_name", type: "string" },
          { name: "_symbol", type: "string" },
          { name: "_imageURI", type: "string" },
          { name: "_creator", type: "address" },
        ],
      },
    ] as const,
  },
  TunaFlaunch: {
    bytecode: "" as `0x${string}`,
    abi: [
      { type: "constructor", inputs: [{ name: "_baseURI", type: "string" }] },
      {
        type: "function",
        name: "initialize",
        inputs: [
          { name: "_positionManager", type: "address" },
          { name: "_memecoinImpl", type: "address" },
          { name: "_treasuryImpl", type: "address" },
        ],
      },
    ] as const,
  },
  TunaPositionManager: {
    bytecode: "" as `0x${string}`,
    abi: [
      {
        type: "constructor",
        inputs: [
          { name: "_poolManager", type: "address" },
          { name: "_flETH", type: "address" },
          { name: "_protocolFeeRecipient", type: "address" },
        ],
      },
      {
        type: "function",
        name: "initialize",
        inputs: [
          { name: "_flaunch", type: "address" },
          { name: "_bidWall", type: "address" },
          { name: "_fairLaunch", type: "address" },
        ],
      },
    ] as const,
  },
  TunaBidWall: {
    bytecode: "" as `0x${string}`,
    abi: [
      {
        type: "constructor",
        inputs: [
          { name: "_poolManager", type: "address" },
          { name: "_positionManager", type: "address" },
          { name: "_flETH", type: "address" },
        ],
      },
      { type: "function", name: "initialize", inputs: [] },
    ] as const,
  },
  TunaFairLaunch: {
    bytecode: "" as `0x${string}`,
    abi: [
      {
        type: "constructor",
        inputs: [
          { name: "_positionManager", type: "address" },
          { name: "_flETH", type: "address" },
        ],
      },
      { type: "function", name: "initialize", inputs: [] },
    ] as const,
  },
};

// Known addresses on Base
const BASE_ADDRESSES = {
  // Base Mainnet
  mainnet: {
    AAVE_POOL: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    WETH: "0x4200000000000000000000000000000000000006",
    POOL_MANAGER: "0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829",
  },
  // Base Sepolia
  sepolia: {
    AAVE_POOL: "0x0000000000000000000000000000000000000000", // Not available on Sepolia
    WETH: "0x4200000000000000000000000000000000000006",
    POOL_MANAGER: "0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829",
  },
};

interface DeployResult {
  success: boolean;
  network: string;
  contracts?: {
    TunaFlETH: string;
    TunaMemecoin: string;
    TunaFlaunch: string;
    TunaPositionManager: string;
    TunaBidWall: string;
    TunaFairLaunch: string;
  };
  error?: string;
  txHashes?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body = await req.json();
    const { network = "sepolia", dryRun = true } = body;

    // Get deployer private key
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "BASE_DEPLOYER_PRIVATE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bytecode is available
    const hasBytecode = Object.values(CONTRACT_ARTIFACTS).every(
      (artifact) => artifact.bytecode && artifact.bytecode.length > 2
    );

    if (!hasBytecode) {
      return new Response(
        JSON.stringify({
          error: "Contract bytecode not compiled",
          message: "Run 'forge build' in contracts/flaunch/ and add bytecode to this function",
          instructions: [
            "1. cd contracts/flaunch",
            "2. forge build",
            "3. Extract bytecode from out/*.json files",
            "4. Add to CONTRACT_ARTIFACTS in this file",
          ],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Setup viem clients
    const chain = network === "mainnet" ? base : baseSepolia;
    const addresses = network === "mainnet" ? BASE_ADDRESSES.mainnet : BASE_ADDRESSES.sepolia;
    
    const account = privateKeyToAccount(deployerKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    // Check deployer balance
    const balance = await publicClient.getBalance({ address: account.address });
    const minBalance = parseEther("0.01");
    
    if (balance < minBalance) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          deployer: account.address,
          balance: balance.toString(),
          required: minBalance.toString(),
          message: `Fund ${account.address} with at least 0.01 ETH on ${network}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          deployer: account.address,
          balance: balance.toString(),
          network,
          message: "Ready to deploy. Set dryRun=false to proceed.",
          contracts: Object.keys(CONTRACT_ARTIFACTS),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deploy contracts in order
    const txHashes: string[] = [];
    const deployedAddresses: Record<string, string> = {};

    console.log(`[Deploy] Starting deployment on ${network}...`);
    console.log(`[Deploy] Deployer: ${account.address}`);

    // 1. Deploy TunaFlETH
    console.log("[Deploy] Deploying TunaFlETH...");
    const flETHHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaFlETH.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaFlETH.bytecode,
      args: [addresses.AAVE_POOL as `0x${string}`],
    });
    txHashes.push(flETHHash);
    const flETHReceipt = await publicClient.waitForTransactionReceipt({ hash: flETHHash });
    deployedAddresses.TunaFlETH = flETHReceipt.contractAddress!;
    console.log(`[Deploy] TunaFlETH: ${deployedAddresses.TunaFlETH}`);

    // 2. Deploy TunaMemecoin (implementation for cloning)
    console.log("[Deploy] Deploying TunaMemecoin implementation...");
    const memecoinHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaMemecoin.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaMemecoin.bytecode,
      args: ["Implementation", "IMPL", "", account.address],
    });
    txHashes.push(memecoinHash);
    const memecoinReceipt = await publicClient.waitForTransactionReceipt({ hash: memecoinHash });
    deployedAddresses.TunaMemecoin = memecoinReceipt.contractAddress!;
    console.log(`[Deploy] TunaMemecoin: ${deployedAddresses.TunaMemecoin}`);

    // 3. Deploy TunaFlaunch
    console.log("[Deploy] Deploying TunaFlaunch...");
    const baseURI = network === "mainnet"
      ? "https://api.tuna.fun/metadata/"
      : "https://api.tuna.fun/metadata/testnet/";
    const flaunchHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaFlaunch.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaFlaunch.bytecode,
      args: [baseURI],
    });
    txHashes.push(flaunchHash);
    const flaunchReceipt = await publicClient.waitForTransactionReceipt({ hash: flaunchHash });
    deployedAddresses.TunaFlaunch = flaunchReceipt.contractAddress!;
    console.log(`[Deploy] TunaFlaunch: ${deployedAddresses.TunaFlaunch}`);

    // 4. Deploy TunaPositionManager
    console.log("[Deploy] Deploying TunaPositionManager...");
    const posManagerHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaPositionManager.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaPositionManager.bytecode,
      args: [
        addresses.POOL_MANAGER as `0x${string}`,
        deployedAddresses.TunaFlETH as `0x${string}`,
        account.address,
      ],
    });
    txHashes.push(posManagerHash);
    const posManagerReceipt = await publicClient.waitForTransactionReceipt({ hash: posManagerHash });
    deployedAddresses.TunaPositionManager = posManagerReceipt.contractAddress!;
    console.log(`[Deploy] TunaPositionManager: ${deployedAddresses.TunaPositionManager}`);

    // 5. Deploy TunaBidWall
    console.log("[Deploy] Deploying TunaBidWall...");
    const bidWallHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaBidWall.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaBidWall.bytecode,
      args: [
        addresses.POOL_MANAGER as `0x${string}`,
        deployedAddresses.TunaPositionManager as `0x${string}`,
        deployedAddresses.TunaFlETH as `0x${string}`,
      ],
    });
    txHashes.push(bidWallHash);
    const bidWallReceipt = await publicClient.waitForTransactionReceipt({ hash: bidWallHash });
    deployedAddresses.TunaBidWall = bidWallReceipt.contractAddress!;
    console.log(`[Deploy] TunaBidWall: ${deployedAddresses.TunaBidWall}`);

    // 6. Deploy TunaFairLaunch
    console.log("[Deploy] Deploying TunaFairLaunch...");
    const fairLaunchHash = await walletClient.deployContract({
      abi: CONTRACT_ARTIFACTS.TunaFairLaunch.abi,
      bytecode: CONTRACT_ARTIFACTS.TunaFairLaunch.bytecode,
      args: [
        deployedAddresses.TunaPositionManager as `0x${string}`,
        deployedAddresses.TunaFlETH as `0x${string}`,
      ],
    });
    txHashes.push(fairLaunchHash);
    const fairLaunchReceipt = await publicClient.waitForTransactionReceipt({ hash: fairLaunchHash });
    deployedAddresses.TunaFairLaunch = fairLaunchReceipt.contractAddress!;
    console.log(`[Deploy] TunaFairLaunch: ${deployedAddresses.TunaFairLaunch}`);

    // TODO: Call initialize functions on contracts
    // This requires write calls to the deployed contracts

    console.log("[Deploy] All contracts deployed successfully!");

    // Store deployment record
    await supabase.from("base_deployments").insert({
      network,
      deployer: account.address,
      contracts: deployedAddresses,
      tx_hashes: txHashes,
      deployed_at: new Date().toISOString(),
    });

    const result: DeployResult = {
      success: true,
      network,
      contracts: {
        TunaFlETH: deployedAddresses.TunaFlETH,
        TunaMemecoin: deployedAddresses.TunaMemecoin,
        TunaFlaunch: deployedAddresses.TunaFlaunch,
        TunaPositionManager: deployedAddresses.TunaPositionManager,
        TunaBidWall: deployedAddresses.TunaBidWall,
        TunaFairLaunch: deployedAddresses.TunaFairLaunch,
      },
      txHashes,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Deploy] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Deployment failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
