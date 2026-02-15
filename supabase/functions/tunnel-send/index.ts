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
    const { tunnelPrivateKey, destination, lamports } = await req.json();

    if (!tunnelPrivateKey || !destination || !lamports) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) throw new Error("HELIUS_RPC_URL not configured");

    const connection = new Connection(rpcUrl, "confirmed");
    const tunnelKeypair = Keypair.fromSecretKey(bs58.default.decode(tunnelPrivateKey));
    const destPubkey = new PublicKey(destination);

    console.log(`Sending ${lamports / LAMPORTS_PER_SOL} SOL from ${tunnelKeypair.publicKey.toBase58()} to ${destination}`);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: tunnelKeypair.publicKey,
        toPubkey: destPubkey,
        lamports,
      })
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = tunnelKeypair.publicKey;
    tx.sign(tunnelKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`Transfer confirmed: ${signature}`);

    return new Response(JSON.stringify({ success: true, signature }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("tunnel-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
