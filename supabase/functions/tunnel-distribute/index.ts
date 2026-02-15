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
    const { sourcePrivateKey, destinations, amountPerWallet } = await req.json();

    if (!sourcePrivateKey || !destinations?.length || !amountPerWallet) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) throw new Error("HELIUS_RPC_URL not configured");

    const connection = new Connection(rpcUrl, "confirmed");

    const sourceKeypair = Keypair.fromSecretKey(bs58.default.decode(sourcePrivateKey));
    const sourceBalance = await connection.getBalance(sourceKeypair.publicKey);
    console.log(`Source wallet: ${sourceKeypair.publicKey.toBase58()}, balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`);

    const lamportsPerWallet = Math.round(amountPerWallet * LAMPORTS_PER_SOL);
    const feePerTx = 5000;

    // Each destination gets 2 fresh tunnel keypairs: source -> t1 -> t2 -> dest
    // Cost per destination: lamports + 3 tx fees (source->t1, t1->t2, t2->dest)
    const costPerDest = lamportsPerWallet + (3 * feePerTx);
    const totalNeeded = destinations.length * costPerDest + (destinations.length * feePerTx); // extra buffer

    console.log(`Total needed: ${totalNeeded / LAMPORTS_PER_SOL} SOL for ${destinations.length} destinations`);

    if (sourceBalance < totalNeeded) {
      return new Response(JSON.stringify({ 
        error: `Insufficient balance. Need ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(6)} SOL, have ${(sourceBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate 2 fresh tunnel keypairs per destination
    const hops: Array<{
      destination: string;
      tunnel1: { publicKey: string; secretKey: string };
      tunnel2: { publicKey: string; secretKey: string };
      status: string;
      fundingSig?: string;
    }> = [];

    const signatures: string[] = [];

    for (let i = 0; i < destinations.length; i++) {
      const t1 = Keypair.generate();
      const t2 = Keypair.generate();

      // Fund tunnel1 with enough for: amount + 2 tx fees (t1->t2 and t2->dest)
      const tunnel1Needs = lamportsPerWallet + (2 * feePerTx);

      console.log(`[${i + 1}/${destinations.length}] Funding tunnel1 ${t1.publicKey.toBase58().slice(0, 8)}... with ${tunnel1Needs / LAMPORTS_PER_SOL} SOL`);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourceKeypair.publicKey,
          toPubkey: t1.publicKey,
          lamports: tunnel1Needs,
        })
      );
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = sourceKeypair.publicKey;
      tx.sign(sourceKeypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      signatures.push(sig);

      hops.push({
        destination: destinations[i],
        tunnel1: { publicKey: t1.publicKey.toBase58(), secretKey: bs58.default.encode(t1.secretKey) },
        tunnel2: { publicKey: t2.publicKey.toBase58(), secretKey: bs58.default.encode(t2.secretKey) },
        status: "funded",
        fundingSig: sig,
      });

      console.log(`[${i + 1}] Tunnel1 funded: ${sig}`);
    }

    // Save run to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: run } = await supabase.from("tunnel_distribution_runs").insert({
      source_wallet: sourceKeypair.publicKey.toBase58(),
      amount_per_wallet: amountPerWallet,
      status: "in_progress",
      tunnel_keys: hops.map(h => ({ tunnel1: h.tunnel1, tunnel2: h.tunnel2 })),
      hops: hops.map(h => ({ destination: h.destination, status: "funded", fundingSig: h.fundingSig })),
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      runId: run?.id,
      hops,
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
