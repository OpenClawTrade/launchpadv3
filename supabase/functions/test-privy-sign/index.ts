/**
 * Diagnostic: Test signTransaction on a specific wallet
 */

import canonicalize from "npm:canonicalize@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function p1363ToDer(p1363: Uint8Array): Uint8Array {
  const half = p1363.length / 2;
  const r = p1363.slice(0, half);
  const s = p1363.slice(half);
  function encodeInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    const needsPad = trimmed[0] & 0x80;
    const result = new Uint8Array((needsPad ? 1 : 0) + trimmed.length + 2);
    result[0] = 0x02;
    result[1] = trimmed.length + (needsPad ? 1 : 0);
    if (needsPad) result[2] = 0x00;
    result.set(trimmed, 2 + (needsPad ? 1 : 0));
    return result;
  }
  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  const seq = new Uint8Array(2 + rDer.length + sDer.length);
  seq[0] = 0x30;
  seq[1] = rDer.length + sDer.length;
  seq.set(rDer, 2);
  seq.set(sDer, 2 + rDer.length);
  return seq;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {};

  try {
    const { walletId, privyDid } = await req.json();
    const appId = Deno.env.get("PRIVY_APP_ID")!;
    const appSecret = Deno.env.get("PRIVY_APP_SECRET")!;
    const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY")!;
    const credentials = btoa(`${appId}:${appSecret}`);

    // Step 1: Get user's wallet info to check owner_id
    let targetWalletId = walletId;
    
    if (privyDid && !walletId) {
      const userRes = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(privyDid)}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
          "privy-app-id": appId,
        },
      });
      const userData = await userRes.json();
      results.userFound = !!userData?.id;
      
      const solWallet = userData?.linked_accounts?.find(
        (a: any) => a.type === "wallet" && a.chain_type === "solana" && 
        (a.wallet_client_type === "privy" || a.connector_type === "embedded")
      );
      results.solanaWallet = solWallet ? { address: solWallet.address, id: solWallet.id } : null;
      targetWalletId = solWallet?.id;
    }

    if (!targetWalletId) {
      results.error = "No wallet ID found";
      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    results.targetWalletId = targetWalletId;

    // Step 2: GET wallet details to check owner_id
    const walletInfoRes = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(targetWalletId)}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "privy-app-id": appId,
      },
    });
    results.walletInfoStatus = walletInfoRes.status;
    const walletInfo = await walletInfoRes.json();
    results.walletInfo = walletInfo;

    // Step 3: Try signTransaction with authorization signature
    const privateKeyAsString = authKeyRaw.replace("wallet-auth:", "").trim();
    const binaryString = atob(privateKeyAsString);
    const keyBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      keyBytes[i] = binaryString.charCodeAt(i);
    }
    const privateKey = await crypto.subtle.importKey(
      "pkcs8", keyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
    );

    // Build a minimal signTransaction request (dummy tx, we just want to test auth)
    const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(targetWalletId)}/rpc`;
    const bodyObj = {
      method: "signTransaction",
      params: {
        transaction: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB=",
        encoding: "base64",
      },
    };

    const payload = {
      version: 1,
      method: "POST",
      url,
      body: bodyObj,
      headers: { "privy-app-id": appId },
    };

    const serialized = canonicalize(payload) as string;
    results.signPayloadPreview = serialized.substring(0, 300);
    const payloadBuffer = new TextEncoder().encode(serialized);

    const sigBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      payloadBuffer
    );
    const derSig = p1363ToDer(new Uint8Array(sigBuffer));
    const signature = btoa(String.fromCharCode(...derSig));

    const rpcRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "privy-app-id": appId,
        "Content-Type": "application/json",
        "privy-authorization-signature": signature,
      },
      body: JSON.stringify(bodyObj),
    });

    results.signTransactionStatus = rpcRes.status;
    results.signTransactionResponse = (await rpcRes.text()).substring(0, 500);

    if (rpcRes.status === 401) {
      results.diagnosis = "WALLET_OWNER_MISMATCH";
      results.explanation = "The wallet likely has an owner_id set that doesn't match your authorization key. Check walletInfo.owner_id above.";
    } else if (rpcRes.status === 200) {
      results.diagnosis = "SIGNING_WORKS";
    } else {
      results.diagnosis = "OTHER_ERROR";
    }

  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
