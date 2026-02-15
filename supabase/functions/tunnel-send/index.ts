import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { tunnelPrivateKey, destination, lamports, sendAll } = await req.json();

    if (!tunnelPrivateKey || !destination) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) throw new Error("HELIUS_RPC_URL not configured");

    const connection = new Connection(rpcUrl, "confirmed");
    
    let tunnelKeypair: InstanceType<typeof Keypair>;
    try {
      tunnelKeypair = Keypair.fromSecretKey(bs58.default.decode(tunnelPrivateKey));
    } catch (e) {
      throw new Error(`Invalid tunnel private key: ${e.message}`);
    }
    
    let destPubkey: InstanceType<typeof PublicKey>;
    try {
      destPubkey = new PublicKey(destination);
      if (!PublicKey.isOnCurve(destPubkey)) {
        console.log(`Warning: destination ${destination} is not on curve (may be a PDA, proceeding anyway)`);
      }
    } catch (e) {
      throw new Error(`Invalid destination address "${destination.slice(0,12)}...": ${e.message}`);
    }

    let sendLamports: number;

    if (sendAll) {
      // Send entire balance minus tx fee
      const balance = await connection.getBalance(tunnelKeypair.publicKey);
      const fee = 5000;
      sendLamports = balance - fee;
      if (sendLamports <= 0) {
        throw new Error(`Insufficient balance: ${balance} lamports`);
      }
    } else {
      if (!lamports) throw new Error("Missing lamports or sendAll flag");
      sendLamports = lamports;
    }

    console.log(`Sending ${sendLamports / LAMPORTS_PER_SOL} SOL from ${tunnelKeypair.publicKey.toBase58()} to ${destination}`);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tunnelKeypair.publicKey,
        toPubkey: destPubkey,
        lamports: sendLamports,
      })
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = tunnelKeypair.publicKey;
    tx.sign(tunnelKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`Transfer confirmed: ${signature}`);

    return new Response(JSON.stringify({ success: true, signature, lamportsSent: sendLamports }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("tunnel-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
