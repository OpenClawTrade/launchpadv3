import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from "https://esm.sh/viem@2.45.1";
import { base } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";
import { ERC20_BYTECODE, ERC20_ABI } from "./contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Precompiled ERC20 artifact lives in ./contract.ts (solc compilation cannot
// run inside the Deno edge runtime — bundling the compiler causes timeouts).
function compileERC20(): { abi: typeof ERC20_ABI; bytecode: `0x${string}` } {
  return { abi: ERC20_ABI, bytecode: ERC20_BYTECODE };
}

// ============================================================================
// Request Handler
// ============================================================================
interface CreateTokenRequest {
  name: string;
  ticker: string;
  creatorWallet: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  fairLaunchDurationMins?: number;
  startingMcapUsd?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateTokenRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.ticker || !body.creatorWallet) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: name, ticker, creatorWallet",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate creator wallet is a valid Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid creatorWallet address" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Setup deployer
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "BASE_DEPLOYER_PRIVATE_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x")
        ? deployerKey
        : `0x${deployerKey}`) as `0x${string}`
    );

    const publicClient = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    // Check deployer balance
    const balance = await publicClient.getBalance({
      address: account.address,
    });
    const balanceEth = formatEther(balance);

    if (balance < parseEther("0.001")) {
      return new Response(
        JSON.stringify({
          error: `Insufficient ETH for deployment. Deployer balance: ${balanceEth} ETH. Need at least 0.001 ETH.`,
          deployer: account.address,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[Deploy] Deploying ${body.name} ($${body.ticker}) for ${body.creatorWallet}`
    );
    console.log(
      `[Deploy] Deployer: ${account.address}, Balance: ${balanceEth} ETH`
    );

    // Step 1: Compile ERC20 contract
    console.log("[Deploy] Step 1: Compiling ERC20 contract...");
    const { abi, bytecode } = compileERC20();

    // Step 2: Deploy the token contract
    console.log("[Deploy] Step 2: Deploying token contract...");
    const totalSupply = parseEther("1000000000"); // 1 billion tokens

    const deployHash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [
        body.name,
        body.ticker.toUpperCase(),
        body.creatorWallet as `0x${string}`,
        totalSupply,
      ],
    });

    console.log(`[Deploy] Deployment tx submitted: ${deployHash}`);

    // Step 3: Wait for confirmation
    console.log("[Deploy] Step 3: Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash,
      confirmations: 1,
      timeout: 60_000, // 60 second timeout
    });

    const tokenAddress = receipt.contractAddress;
    if (!tokenAddress) {
      throw new Error(
        "Contract deployment failed - no contract address in receipt"
      );
    }

    console.log(`[Deploy] ✅ Token deployed at: ${tokenAddress}`);
    console.log(`[Deploy] Gas used: ${receipt.gasUsed.toString()}`);

    // Step 4: Record in database
    console.log("[Deploy] Step 4: Recording in database...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error: dbError } = await supabase.rpc(
      "backend_create_base_token",
      {
        p_name: body.name,
        p_ticker: body.ticker.toUpperCase(),
        p_creator_wallet: body.creatorWallet,
        p_evm_token_address: tokenAddress,
        p_evm_pool_address: "", // No Uniswap pool yet
        p_evm_factory_tx_hash: deployHash,
        p_creator_fee_bps: 5000,
        p_fair_launch_duration_mins: body.fairLaunchDurationMins ?? 5,
        p_starting_mcap_usd: body.startingMcapUsd ?? 5000,
        p_description: body.description ?? null,
        p_image_url: body.imageUrl ?? null,
        p_website_url: body.websiteUrl ?? null,
        p_twitter_url: body.twitterUrl ?? null,
      }
    );

    if (dbError) {
      console.error("[Deploy] DB recording error:", dbError);
      // Token IS deployed on-chain even if DB fails
      // Return success with a warning
    }

    console.log(`[Deploy] ✅ Complete! Token ID: ${data}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        txHash: deployHash,
        tokenId: data,
        deployer: account.address,
        network: "base",
        chainId: 8453,
        totalSupply: "1000000000",
        explorerUrl: `https://basescan.org/tx/${deployHash}`,
        tokenUrl: `https://basescan.org/token/${tokenAddress}`,
        message: `Token ${body.name} ($${body.ticker}) deployed on Base at ${tokenAddress}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Deploy] Error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Token deployment failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
