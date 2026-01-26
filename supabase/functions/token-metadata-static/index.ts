import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * Static token metadata endpoint that returns metadata from URL query params.
 * This is used for tokens that are created on-chain BEFORE being saved to the database
 * (e.g., Phantom-signed launches where the user signs first, then we record).
 * 
 * Query params:
 * - name: Token name
 * - symbol: Token symbol/ticker
 * - description: Token description
 * - image: Image URL
 * - website: Website URL (optional)
 * - twitter: Twitter URL (optional)
 * - telegram: Telegram URL (optional)
 * - discord: Discord URL (optional)
 * - creator: Creator wallet address
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Get metadata from query params
    const name = url.searchParams.get("name") || "Unknown Token";
    const symbol = url.searchParams.get("symbol") || "???";
    const description = url.searchParams.get("description") || `${name} token`;
    const image = url.searchParams.get("image") || "";
    const website = url.searchParams.get("website") || "";
    const twitter = url.searchParams.get("twitter") || "";
    const telegram = url.searchParams.get("telegram") || "";
    const discord = url.searchParams.get("discord") || "";
    const creator = url.searchParams.get("creator") || "";

    // Get mint from path for logging
    const pathParts = url.pathname.split("/");
    const mintAddress = pathParts[pathParts.length - 1];
    
    console.log(`[token-metadata-static] Serving metadata for: ${mintAddress}`);
    console.log(`[token-metadata-static] Name: ${name}, Symbol: ${symbol}, Image: ${image?.substring(0, 50)}...`);

    // Append #ai67x hashtag for Solscan visibility
    const descriptionWithTag = description.includes("#ai67x")
      ? description
      : `${description} #ai67x`;

    // Build Metaplex-standard metadata JSON
    const metadata: Record<string, unknown> = {
      name,
      symbol: symbol.toUpperCase(),
      description: descriptionWithTag,
      image,
      external_url: website || `https://ai67x.io/token/${mintAddress}`,
      tags: ["Meme", "ai67x"],
      attributes: [
        { trait_type: "Platform", value: "ai67x" },
        { trait_type: "Status", value: "bonding" },
      ],
      properties: {
        files: image
          ? [{ uri: image, type: "image/png" }]
          : [],
        category: "image",
        creators: creator
          ? [{ address: creator, share: 100 }]
          : [],
      },
    };

    // Add social links as extensions
    const extensions: Record<string, string> = {};
    if (website) extensions.website = website;
    if (twitter) extensions.twitter = twitter;
    if (telegram) extensions.telegram = telegram;
    if (discord) extensions.discord = discord;

    if (Object.keys(extensions).length > 0) {
      metadata.extensions = extensions;
    }

    // Also add to properties.links for better compatibility
    const links: Record<string, string> = {};
    if (website) links.website = website;
    if (twitter) links.twitter = twitter;
    if (telegram) links.telegram = telegram;
    if (discord) links.discord = discord;

    if (Object.keys(links).length > 0) {
      (metadata.properties as Record<string, unknown>).links = links;
    }

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours (immutable metadata)
      },
    });
  } catch (error) {
    console.error("[token-metadata-static] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
