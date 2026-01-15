import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

// Jito tip accounts
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
];

// Config
const SNIPER_BUY_SOL = 0.5;
const TIP_LAMPORTS = 10_000_000; // 0.01 SOL
const PRIORITY_FEE_LAMPORTS = 5_000_000; // 0.005 SOL
const COMPUTE_UNITS = 400_000;

function getRandomTipAccount(): string {
  return JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
}

function getRandomBlockEngine(): string {
  return JITO_BLOCK_ENGINES[Math.floor(Math.random() * JITO_BLOCK_ENGINES.length)];
}

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
    const { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram } = 
      await import('https://esm.sh/@solana/web3.js@1.98.0');

    const sniperKeypair = Keypair.fromSecretKey(sniperSecretKey);
    const sniperWallet = sniperKeypair.publicKey.toBase58();
    console.log('[fun-sniper-buy] Sniper wallet:', sniperWallet);

    // Create sniper trade record
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

    // Connect to RPC
    const connection = new Connection(heliusRpcUrl, 'confirmed');

    // Get sniper balance
    const balance = await connection.getBalance(sniperKeypair.publicKey);
    const balanceSol = balance / 1_000_000_000;
    console.log('[fun-sniper-buy] Sniper balance:', balanceSol, 'SOL');

    if (balanceSol < SNIPER_BUY_SOL + 0.02) {
      throw new Error(`Insufficient sniper balance: ${balanceSol} SOL (need ${SNIPER_BUY_SOL + 0.02})`);
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
        buildOnly: true, // Just build, don't send
      }),
    });

    const swapResult = await swapResponse.json();
    
    if (!swapResult.success && !swapResult.transaction) {
      console.error('[fun-sniper-buy] Swap build failed:', swapResult);
      throw new Error(swapResult.error || 'Failed to build swap transaction');
    }

    console.log('[fun-sniper-buy] Swap transaction built, estimated tokens:', swapResult.estimatedOutput);

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Build final transaction with priority fees and Jito tip
    const tx = new Transaction();
    
    // Add compute budget instructions
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ 
      microLamports: Math.floor((PRIORITY_FEE_LAMPORTS * 1_000_000) / COMPUTE_UNITS) 
    }));

    // If we got serialized transaction, deserialize and add instructions
    if (swapResult.serializedTransaction) {
      const { decode } = await import('https://deno.land/x/base58@v0.2.1/mod.ts');
      const txBuffer = decode(swapResult.serializedTransaction);
      const decodedTx = Transaction.from(txBuffer);
      for (const ix of decodedTx.instructions) {
        tx.add(ix);
      }
    }

    // Add Jito tip
    const tipAccount = getRandomTipAccount();
    tx.add(SystemProgram.transfer({
      fromPubkey: sniperKeypair.publicKey,
      toPubkey: new PublicKey(tipAccount),
      lamports: TIP_LAMPORTS,
    }));

    tx.recentBlockhash = blockhash;
    tx.feePayer = sniperKeypair.publicKey;

    // Sign transaction
    tx.sign(sniperKeypair);

    // Serialize for Jito
    const { encode } = await import('https://deno.land/x/base58@v0.2.1/mod.ts');
    const serializedTx = encode(tx.serialize());

    // Submit to Jito
    const blockEngine = getRandomBlockEngine();
    console.log('[fun-sniper-buy] Submitting to Jito:', blockEngine);

    const jitoResponse = await fetch(blockEngine, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [[serializedTx]],
      }),
    });

    const jitoResult = await jitoResponse.json();
    let signature: string | null = null;

    if (jitoResult.error) {
      console.error('[fun-sniper-buy] Jito bundle error:', jitoResult.error);
      console.log('[fun-sniper-buy] Falling back to regular transaction...');
      
      // Fallback to regular send
      signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });
    } else {
      console.log('[fun-sniper-buy] Jito bundle submitted:', jitoResult.result);
      // Extract signature from signed tx
      signature = encode(tx.signature!);
    }

    console.log('[fun-sniper-buy] Transaction signature:', signature);

    // Wait for confirmation
    if (signature) {
      try {
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log('[fun-sniper-buy] ✅ Sniper buy confirmed!');

        // Update trade record with success
        await supabase.rpc('backend_update_sniper_buy', {
          p_id: tradeId,
          p_buy_signature: signature,
          p_tokens_received: swapResult.estimatedOutput || 0,
        });

        return new Response(JSON.stringify({
          success: true,
          tradeId,
          signature,
          tokensReceived: swapResult.estimatedOutput,
          sniperWallet,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (confirmError) {
        console.error('[fun-sniper-buy] Confirmation error:', confirmError);
        
        // Mark as failed
        await supabase.rpc('backend_fail_sniper_trade', {
          p_id: tradeId,
          p_error_message: confirmError instanceof Error ? confirmError.message : 'Confirmation failed',
        });

        throw confirmError;
      }
    }

    throw new Error('No signature obtained');

  } catch (error) {
    console.error('[fun-sniper-buy] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
