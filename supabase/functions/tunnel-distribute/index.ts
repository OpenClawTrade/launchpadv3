import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";
import * as bs58 from "https://esm.sh/bs58@6.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourcePrivateKey, destinations, amountPerWallet, adminSecret } = await req.json();

    // Validate admin secret
    const expectedSecret = Deno.env.get("TWITTER_BOT_ADMIN_SECRET");
    if (!adminSecret || adminSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!sourcePrivateKey || !destinations?.length || !amountPerWallet) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) throw new Error("HELIUS_RPC_URL not configured");

    const connection = new Connection(rpcUrl, "confirmed");

    // Decode source keypair
    const sourceKeypair = Keypair.fromSecretKey(bs58.default.decode(sourcePrivateKey));
    const sourceBalance = await connection.getBalance(sourceKeypair.publicKey);
    console.log(`Source wallet: ${sourceKeypair.publicKey.toBase58()}, balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`);

    // Generate 2 tunnel keypairs
    const tunnel1 = Keypair.generate();
    const tunnel2 = Keypair.generate();

    const tunnels = [
      { publicKey: tunnel1.publicKey.toBase58(), secretKey: bs58.default.encode(tunnel1.secretKey) },
      { publicKey: tunnel2.publicKey.toBase58(), secretKey: bs58.default.encode(tunnel2.secretKey) },
    ];

    // Split destinations between tunnels
    const mid = Math.ceil(destinations.length / 2);
    const batch1 = destinations.slice(0, mid);
    const batch2 = destinations.slice(mid);

    const lamportsPerWallet = Math.round(amountPerWallet * LAMPORTS_PER_SOL);
    const feePerTx = 5000; // 0.000005 SOL

    // Calculate how much each tunnel needs
    const tunnel1Needs = (batch1.length * lamportsPerWallet) + (batch1.length * feePerTx) + feePerTx;
    const tunnel2Needs = batch2.length > 0 ? (batch2.length * lamportsPerWallet) + (batch2.length * feePerTx) + feePerTx : 0;
    const totalNeeded = tunnel1Needs + tunnel2Needs + (2 * feePerTx); // extra fees for source->tunnel txs

    console.log(`Total needed: ${totalNeeded / LAMPORTS_PER_SOL} SOL`);

    if (sourceBalance < totalNeeded) {
      return new Response(JSON.stringify({ 
        error: `Insufficient balance. Need ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(6)} SOL, have ${(sourceBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const signatures: string[] = [];

    // Fund tunnel 1
    console.log(`Funding tunnel 1 (${tunnel1.publicKey.toBase58()}) with ${tunnel1Needs / LAMPORTS_PER_SOL} SOL`);
    const tx1 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sourceKeypair.publicKey,
        toPubkey: tunnel1.publicKey,
        lamports: tunnel1Needs,
      })
    );
    tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx1.feePayer = sourceKeypair.publicKey;
    tx1.sign(sourceKeypair);
    const sig1 = await connection.sendRawTransaction(tx1.serialize());
    await connection.confirmTransaction(sig1, "confirmed");
    signatures.push(sig1);
    console.log(`Tunnel 1 funded: ${sig1}`);

    // Fund tunnel 2 (if needed)
    let sig2 = null;
    if (tunnel2Needs > 0) {
      console.log(`Funding tunnel 2 (${tunnel2.publicKey.toBase58()}) with ${tunnel2Needs / LAMPORTS_PER_SOL} SOL`);
      const tx2 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: tunnel2.publicKey,
          lamports: tunnel2Needs,
        })
      );
      tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx2.feePayer = sourceKeypair.publicKey;
      tx2.sign(sourceKeypair);
      sig2 = await connection.sendRawTransaction(tx2.serialize());
      await connection.confirmTransaction(sig2, "confirmed");
      signatures.push(sig2);
      console.log(`Tunnel 2 funded: ${sig2}`);
    }

    // Save run to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const assignments = [
      ...batch1.map((dest: string) => ({ tunnel: 0, destination: dest })),
      ...batch2.map((dest: string) => ({ tunnel: 1, destination: dest })),
    ];

    const { data: run } = await supabase.from("tunnel_distribution_runs").insert({
      source_wallet: sourceKeypair.publicKey.toBase58(),
      amount_per_wallet: amountPerWallet,
      status: "in_progress",
      tunnel_keys: tunnels,
      hops: assignments.map(a => ({ ...a, status: "pending", signature: null })),
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      runId: run?.id,
      tunnels,
      assignments,
      fundingSignatures: signatures,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("tunnel-distribute error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
