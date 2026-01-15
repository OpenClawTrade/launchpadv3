import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config
const SNIPER_BUY_SOL = 0.5;
const PRIORITY_FEE_LAMPORTS = 5_000_000; // 0.005 SOL total priority fee budget
const COMPUTE_UNITS = 400_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { poolAddress, mintAddress, tokenId, funTokenId } = await req.json();

    console.log('[fun-sniper-buy] Starting sniper buy:', { poolAddress, mintAddress });

    if (!poolAddress || !mintAddress) {
      throw new Error('Missing required fields: poolAddress, mintAddress');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sniperPrivateKey = Deno.env.get('SNIPER_PRIVATE_KEY');
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');

    if (!sniperPrivateKey) {
      throw new Error('SNIPER_PRIVATE_KEY not configured');
    }

    if (!heliusRpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    // Parse sniper keypair
    let sniperSecretKey: Uint8Array;
    try {
      // Try base58 first
      const { decode } = await import('https://deno.land/x/base58@v0.2.1/mod.ts');
      sniperSecretKey = decode(sniperPrivateKey);
    } catch {
      try {
        // Try JSON array
        sniperSecretKey = new Uint8Array(JSON.parse(sniperPrivateKey));
      } catch {
        throw new Error('Invalid SNIPER_PRIVATE_KEY format');
      }
    }

    // Import Solana web3
    const {
      Connection,
      Keypair,
      PublicKey,
      Transaction,
      ComputeBudgetProgram,
    } = await import('https://esm.sh/@solana/web3.js@1.98.0');

    const sniperKeypair = Keypair.fromSecretKey(sniperSecretKey);
    const sniperWallet = sniperKeypair.publicKey.toBase58();
    console.log('[fun-sniper-buy] Sniper wallet:', sniperWallet);

    // Create sniper trade record FIRST (so we always have forensic data)
    const { data: tradeData, error: tradeError } = await supabase.rpc('backend_create_sniper_trade', {
      p_token_id: tokenId || null,
      p_fun_token_id: funTokenId || null,
      p_mint_address: mintAddress,
      p_pool_address: poolAddress,
      p_buy_amount_sol: SNIPER_BUY_SOL,
    });

    if (tradeError) {
      console.error('[fun-sniper-buy] Failed to create trade record:', tradeError);
      throw new Error(`Failed to create trade record: ${tradeError.message}`);
    }

    const tradeId = tradeData;
    console.log('[fun-sniper-buy] Created trade record:', tradeId);

    const connection = new Connection(heliusRpcUrl, 'confirmed');

    // Get sniper balance
    const balance = await connection.getBalance(sniperKeypair.publicKey);
    const balanceSol = balance / 1_000_000_000;
    console.log('[fun-sniper-buy] Sniper balance:', balanceSol, 'SOL');

    // Leave headroom for fees
    if (balanceSol < SNIPER_BUY_SOL + 0.02) {
      const msg = `Insufficient sniper balance: ${balanceSol} SOL (need ${SNIPER_BUY_SOL + 0.02})`;
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw new Error(msg);
    }

    // Build swap transaction using Meteora API
    const meteoraApiUrl = Deno.env.get('METEORA_API_URL') || 'https://trenchespost.vercel.app';

    console.log('[fun-sniper-buy] Building swap transaction via Meteora API...');
    const swapResponse = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        userWallet: sniperWallet,
        amount: SNIPER_BUY_SOL,
        isBuy: true,
        slippageBps: 5000, // 50% slippage for guaranteed execution
        buildOnly: true, // build, don't send
      }),
    });

    const swapResult = await swapResponse.json();

    if (!swapResult.success && !swapResult.serializedTransaction && !swapResult.transaction) {
      console.error('[fun-sniper-buy] Swap build failed:', swapResult);
      const msg = swapResult.error || 'Failed to build swap transaction';
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw new Error(msg);
    }

    // Deserialize swap tx instructions
    const tx = new Transaction();

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }));
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor((PRIORITY_FEE_LAMPORTS * 1_000_000) / COMPUTE_UNITS),
      }),
    );

    // Support both fields (serializedTransaction preferred)
    const encodedTx = swapResult.serializedTransaction || swapResult.transaction;

    if (encodedTx) {
      const { decode } = await import('https://deno.land/x/base58@v0.2.1/mod.ts');
      const txBuffer = decode(encodedTx);
      const decodedTx = Transaction.from(txBuffer);
      for (const ix of decodedTx.instructions) {
        tx.add(ix);
      }
    }

    // Fresh blockhash
    const latest = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = sniperKeypair.publicKey;

    // Sign
    tx.sign(sniperKeypair);

    // Send (no Jito — most reliable)
    console.log('[fun-sniper-buy] Sending transaction...');
    let signature: string;

    try {
      signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : 'sendRawTransaction failed';
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw sendErr;
    }

    console.log('[fun-sniper-buy] Signature:', signature);

    try {
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        'confirmed',
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('[fun-sniper-buy] ✅ Sniper buy confirmed!');

      await supabase.rpc('backend_update_sniper_buy', {
        p_id: tradeId,
        p_buy_signature: signature,
        p_tokens_received: swapResult.estimatedOutput || 0,
      });

      return new Response(
        JSON.stringify({
          success: true,
          tradeId,
          signature,
          tokensReceived: swapResult.estimatedOutput,
          sniperWallet,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (confirmError) {
      console.error('[fun-sniper-buy] Confirmation error:', confirmError);

      await supabase.rpc('backend_fail_sniper_trade', {
        p_id: tradeId,
        p_error_message: confirmError instanceof Error ? confirmError.message : 'Confirmation failed',
      });

      throw confirmError;
    }
  } catch (error) {
    console.error('[fun-sniper-buy] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
