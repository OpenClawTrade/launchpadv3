import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_BASE_URL = "https://api.jup.ag/swap/v1";

const SKIP_MINTS = new Set([
  WSOL_MINT,
  "11111111111111111111111111111111",
]);

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

interface WalletHolding {
  mint: string;
  balance: number;
  rawAmount: string;
  decimals: number;
  estimatedValueSol: number | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  isTracked: boolean;
  dbPositionId: string | null;
  dbPositionStatus: string | null;
  program: string;
}

async function getJupiterQuoteSafe(
  inputMint: string,
  amount: string,
  jupiterApiKey: string
): Promise<number | null> {
  try {
    const url = `${JUPITER_BASE_URL}/quote?inputMint=${inputMint}&outputMint=${WSOL_MINT}&amount=${amount}&slippageBps=1500`;
    const resp = await fetch(url, {
      headers: { "x-api-key": jupiterApiKey },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return parseInt(data.outAmount) / 1e9;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId } = await req.json();
    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    const jupiterApiKey = Deno.env.get("JUPITER_API_KEY") || "";

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from("trading_agents")
      .select("id, name, wallet_address, status")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletPubkey = new PublicKey(agent.wallet_address);

    // Fetch SOL balance
    const solBalance = await connection.getBalance(walletPubkey);
    const solBalanceDisplay = solBalance / 1e9;

    // Fetch token accounts from both programs in parallel
    const [splAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(walletPubkey, { programId: TOKEN_PROGRAM }),
      connection.getParsedTokenAccountsByOwner(walletPubkey, { programId: TOKEN_2022_PROGRAM }),
    ]);

    // Get DB positions for cross-reference
    const { data: dbPositions } = await supabase
      .from("trading_agent_positions")
      .select("id, token_address, token_name, token_symbol, status")
      .eq("trading_agent_id", agentId);

    const dbMap = new Map(
      (dbPositions || []).map((p) => [p.token_address, p])
    );

    const holdings: WalletHolding[] = [];

    const allAccounts = [
      ...splAccounts.value.map((a) => ({ ...a, program: "spl-token" })),
      ...token2022Accounts.value.map((a) => ({ ...a, program: "token-2022" })),
    ];

    // Process accounts and get Jupiter quotes in parallel (batch of 5)
    const accountData = allAccounts
      .map((account) => {
        const parsed = account.account.data.parsed?.info;
        if (!parsed) return null;
        const mint = parsed.mint;
        const tokenAmount = parsed.tokenAmount;
        const rawAmount = tokenAmount?.amount || "0";
        const balance = tokenAmount?.uiAmount || 0;
        const decimals = tokenAmount?.decimals || 0;
        if (parseInt(rawAmount) === 0 || SKIP_MINTS.has(mint)) return null;
        return { mint, rawAmount, balance, decimals, program: (account as any).program };
      })
      .filter(Boolean) as Array<{
        mint: string;
        rawAmount: string;
        balance: number;
        decimals: number;
        program: string;
      }>;

    // Get quotes in batches of 5 to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < accountData.length; i += BATCH_SIZE) {
      const batch = accountData.slice(i, i + BATCH_SIZE);
      const quotes = await Promise.all(
        batch.map((a) =>
          jupiterApiKey
            ? getJupiterQuoteSafe(a.mint, a.rawAmount, jupiterApiKey)
            : Promise.resolve(null)
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const a = batch[j];
        const dbPos = dbMap.get(a.mint);
        holdings.push({
          mint: a.mint,
          balance: a.balance,
          rawAmount: a.rawAmount,
          decimals: a.decimals,
          estimatedValueSol: quotes[j],
          tokenName: dbPos?.token_name || null,
          tokenSymbol: dbPos?.token_symbol || null,
          isTracked: !!dbPos,
          dbPositionId: dbPos?.id || null,
          dbPositionStatus: dbPos?.status || null,
          program: a.program,
        });
      }
    }

    // Sort by estimated value descending
    holdings.sort((a, b) => (b.estimatedValueSol || 0) - (a.estimatedValueSol || 0));

    const totalEstimatedValue = holdings.reduce(
      (sum, h) => sum + (h.estimatedValueSol || 0),
      0
    );

    return new Response(
      JSON.stringify({
        walletAddress: agent.wallet_address,
        solBalance: solBalanceDisplay,
        holdings,
        totalEstimatedValue,
        totalTokens: holdings.length,
        trackedTokens: holdings.filter((h) => h.isTracked).length,
        untrackedTokens: holdings.filter((h) => !h.isTracked).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[wallet-scan] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
