import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Derive the Metadata PDA for a given mint
function deriveMetadataPDA(mint: PublicKey): PublicKey {
  const seeds = [
    new TextEncoder().encode("metadata"),
    METADATA_PROGRAM_ID.toBytes(),
    mint.toBytes(),
  ];
  
  const [pda] = PublicKey.findProgramAddressSync(seeds, METADATA_PROGRAM_ID);
  return pda;
}

// Parse Metaplex metadata from account data
function parseMetadata(data: Uint8Array): {
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  updateAuthority: string;
} | null {
  try {
    // Skip discriminator (1 byte) + update authority (32 bytes) + mint (32 bytes)
    let offset = 1 + 32 + 32;
    
    // Read name (4 bytes length + data)
    const nameLen = new DataView(data.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    const name = new TextDecoder().decode(data.slice(offset, offset + nameLen)).replace(/\0/g, '').trim();
    offset += nameLen;
    
    // Read symbol (4 bytes length + data)
    const symbolLen = new DataView(data.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    const symbol = new TextDecoder().decode(data.slice(offset, offset + symbolLen)).replace(/\0/g, '').trim();
    offset += symbolLen;
    
    // Read uri (4 bytes length + data)
    const uriLen = new DataView(data.buffer, offset, 4).getUint32(0, true);
    offset += 4;
    const uri = new TextDecoder().decode(data.slice(offset, offset + uriLen)).replace(/\0/g, '').trim();
    offset += uriLen;
    
    // Skip to isMutable (after seller_fee_basis_points + creators option + primary_sale_happened)
    // This is a simplified parse - isMutable is at a variable offset due to creators array
    
    // Read update authority from beginning
    const updateAuthority = new PublicKey(data.slice(1, 33)).toBase58();
    
    return {
      name,
      symbol,
      uri,
      isMutable: true, // Simplified - full parse would check actual offset
      updateAuthority,
    };
  } catch (e) {
    console.error("Failed to parse metadata:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mintAddress = url.searchParams.get("mint");
    
    if (!mintAddress) {
      return new Response(
        JSON.stringify({ error: "Missing 'mint' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate mint address
    let mintPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(mintAddress);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid mint address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect to Helius RPC
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!rpcUrl) {
      return new Response(
        JSON.stringify({ error: "HELIUS_RPC_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");

    // Derive metadata PDA
    const metadataPDA = deriveMetadataPDA(mintPubkey);
    console.log(`[onchain-metadata-debug] Mint: ${mintAddress}`);
    console.log(`[onchain-metadata-debug] Metadata PDA: ${metadataPDA.toBase58()}`);

    // Fetch metadata account
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    
    if (!accountInfo) {
      return new Response(
        JSON.stringify({ 
          error: "Metadata account not found",
          mint: mintAddress,
          metadataPDA: metadataPDA.toBase58(),
          exists: false,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse metadata
    const metadata = parseMetadata(accountInfo.data);
    
    if (!metadata) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse metadata",
          mint: mintAddress,
          metadataPDA: metadataPDA.toBase58(),
          exists: true,
          dataLength: accountInfo.data.length,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also try to fetch the URI to verify it's accessible
    let uriAccessible = false;
    let uriContent: unknown = null;
    let uriError: string | null = null;
    
    if (metadata.uri) {
      try {
        const uriResponse = await fetch(metadata.uri, { 
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        
        if (uriResponse.ok) {
          uriAccessible = true;
          uriContent = await uriResponse.json();
        } else {
          uriError = `HTTP ${uriResponse.status}: ${uriResponse.statusText}`;
        }
      } catch (e) {
        uriError = e instanceof Error ? e.message : "Unknown fetch error";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mint: mintAddress,
        metadataPDA: metadataPDA.toBase58(),
        onChainMetadata: metadata,
        uriCheck: {
          accessible: uriAccessible,
          error: uriError,
          content: uriContent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[onchain-metadata-debug] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
