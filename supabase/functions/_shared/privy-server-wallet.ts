/**
 * Privy Server Wallet Helper
 * 
 * Wraps the Privy REST API for server-side wallet operations.
 * Uses Basic Auth with PRIVY_APP_ID:PRIVY_APP_SECRET.
 * Includes authorization signature for wallet RPC calls.
 * 
 * Docs: https://docs.privy.io/reference/rest-auth/
 * Auth Signatures: https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
 */

// Use the npm canonicalize package recommended by Privy docs
import canonicalize from "npm:canonicalize@2.0.0";

const PRIVY_API_BASE = "https://auth.privy.io";

interface PrivyWalletAccount {
  type: string;
  address: string;
  chain_type: string;
  wallet_client: string;
  wallet_client_type: string;
  connector_type: string;
  id?: string;
}

interface PrivyUser {
  id: string;
  linked_accounts: PrivyWalletAccount[];
}

// --- Authorization Signature (per Privy docs) ---

async function getAuthorizationSignature(
  url: string,
  body: Record<string, unknown>
): Promise<string> {
  const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY");
  if (!authKeyRaw) {
    throw new Error("PRIVY_AUTHORIZATION_KEY must be configured for wallet RPC calls");
  }

  const appId = Deno.env.get("PRIVY_APP_ID");
  if (!appId) {
    throw new Error("PRIVY_APP_ID must be configured");
  }

  // Strip "wallet-auth:" prefix (per Privy docs)
  const privKeyBase64 = authKeyRaw.replace(/^wallet-auth:/, "").trim();

  // Build PEM from base64 (exactly as Privy docs show)
  const pem = `-----BEGIN PRIVATE KEY-----\n${privKeyBase64}\n-----END PRIVATE KEY-----`;

  // Decode PEM to DER for Web Crypto
  const privKeyDer = Uint8Array.from(atob(privKeyBase64), (c) => c.charCodeAt(0));

  // Import as ECDSA P-256 PKCS8 key
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      privKeyDer.buffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    console.log("[privy-auth] Key imported successfully");
  } catch (e) {
    console.error("[privy-auth] Key import failed:", e);
    throw new Error(`Failed to import PRIVY_AUTHORIZATION_KEY: ${e}`);
  }

  // Build the signature payload per Privy docs
  const payload = {
    version: 1,
    method: "POST" as const,
    url,
    body,
    headers: {
      "privy-app-id": appId,
    },
  };

  // Canonicalize using the npm package (exactly as Privy docs recommend)
  const serializedPayload = canonicalize(payload) as string;
  console.log("[privy-auth] Canonicalized payload:", serializedPayload.substring(0, 200) + "...");
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(serializedPayload);

  // Sign with ECDSA P-256 + SHA-256
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    payloadBytes
  );

  // Web Crypto returns P1363 format (r||s, 64 bytes for P-256)
  // Node.js crypto.sign returns DER format by default
  // Try DER format first since Privy docs use Node.js crypto.sign
  const p1363Sig = new Uint8Array(signatureBuffer);
  const derSig = p1363ToDer(p1363Sig);
  
  const sigBase64 = btoa(String.fromCharCode(...derSig));
  console.log("[privy-auth] Signature (DER, base64) length:", sigBase64.length);
  
  return sigBase64;
}

// Convert P1363 (r||s) to DER encoding
function p1363ToDer(sig: Uint8Array): Uint8Array {
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);

  function intBytes(buf: Uint8Array): Uint8Array {
    let start = 0;
    while (start < buf.length - 1 && buf[start] === 0) start++;
    const trimmed = buf.slice(start);
    if (trimmed[0] & 0x80) {
      const padded = new Uint8Array(trimmed.length + 1);
      padded[0] = 0;
      padded.set(trimmed, 1);
      return padded;
    }
    return trimmed;
  }

  const rDer = intBytes(r);
  const sDer = intBytes(s);
  const seqLen = 2 + rDer.length + 2 + sDer.length;
  const der = new Uint8Array(2 + seqLen);
  let i = 0;
  der[i++] = 0x30;
  der[i++] = seqLen;
  der[i++] = 0x02;
  der[i++] = rDer.length;
  der.set(rDer, i); i += rDer.length;
  der[i++] = 0x02;
  der[i++] = sDer.length;
  der.set(sDer, i);
  return der;
}

// --- Auth Headers ---

function getAuthHeaders(): Record<string, string> {
  const appId = Deno.env.get("PRIVY_APP_ID");
  const appSecret = Deno.env.get("PRIVY_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
  }

  const credentials = btoa(`${appId}:${appSecret}`);
  return {
    Authorization: `Basic ${credentials}`,
    "privy-app-id": appId,
    "Content-Type": "application/json",
  };
}

/**
 * Look up a Privy user and return their linked accounts.
 */
export async function getPrivyUser(privyDid: string): Promise<PrivyUser> {
  const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/${encodeURIComponent(privyDid)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy getUser failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Find the Solana embedded wallet from a Privy user's linked accounts.
 */
export function findSolanaEmbeddedWallet(
  user: PrivyUser
): { address: string; walletId: string } | null {
  const wallet = user.linked_accounts.find(
    (a) =>
      a.type === "wallet" &&
      a.chain_type === "solana" &&
      (a.wallet_client_type === "privy" || a.connector_type === "embedded")
  );

  if (!wallet || !wallet.id) return null;

  return {
    address: wallet.address,
    walletId: wallet.id,
  };
}

/**
 * Sign and send a Solana transaction using Privy's server-side wallet RPC.
 * Uses auth.privy.io/api/v1 for wallet operations.
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  rpcUrl: string
): Promise<string> {
  const url = `${PRIVY_API_BASE}/api/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signAndSendTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

  console.log("[privy-auth] Generating signature for URL:", url);

  // Generate authorization signature
  const authSignature = await getAuthorizationSignature(url, bodyObj);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signAndSendTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.hash || data.data?.signature || data.hash || data.signature;
}

/**
 * Sign a Solana transaction without sending.
 */
export async function signTransaction(
  walletId: string,
  serializedTransaction: string
): Promise<string> {
  const url = `${PRIVY_API_BASE}/api/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

  const authSignature = await getAuthorizationSignature(url, bodyObj);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.signed_transaction || data.signed_transaction;
}

/**
 * Convenience: Look up a user by Privy DID, find their Solana wallet,
 * and return everything needed for server-side signing.
 */
export async function resolveUserWallet(privyDid: string): Promise<{
  privyUserId: string;
  walletAddress: string;
  walletId: string;
}> {
  const user = await getPrivyUser(privyDid);
  const wallet = findSolanaEmbeddedWallet(user);

  if (!wallet) {
    throw new Error(`No Solana embedded wallet found for user ${privyDid}`);
  }

  return {
    privyUserId: user.id,
    walletAddress: wallet.address,
    walletId: wallet.walletId,
  };
}
