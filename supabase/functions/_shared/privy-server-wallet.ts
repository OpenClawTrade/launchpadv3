/**
 * Privy Server Wallet Helper
 * 
 * Wraps the Privy REST API for server-side wallet operations.
 * Uses Basic Auth with PRIVY_APP_ID:PRIVY_APP_SECRET.
 * Includes authorization signature for wallet RPC calls.
 * 
 * Docs: https://docs.privy.io/reference/rest-auth/
 * Auth Signatures: https://docs.privy.io/api-reference/authorization-signatures
 */

const PRIVY_API_BASE = "https://auth.privy.io";
const PRIVY_WALLET_API_BASE = "https://api.privy.io";

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

// --- RFC 8785 JSON Canonicalization ---

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]));
    return "{" + entries.join(",") + "}";
  }
  return "null";
}

// --- P1363 to DER signature conversion ---
// Web Crypto ECDSA outputs P1363 (r||s, 64 bytes for P-256)
// Privy expects DER-encoded signatures (like Node.js crypto.sign)

function p1363ToDer(sig: Uint8Array): Uint8Array {
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);

  function trimAndPad(buf: Uint8Array): Uint8Array {
    // Remove leading zeros
    let start = 0;
    while (start < buf.length - 1 && buf[start] === 0) start++;
    const trimmed = buf.slice(start);
    // If high bit set, prepend 0x00
    if (trimmed[0] & 0x80) {
      const padded = new Uint8Array(trimmed.length + 1);
      padded[0] = 0;
      padded.set(trimmed, 1);
      return padded;
    }
    return trimmed;
  }

  const rDer = trimAndPad(r);
  const sDer = trimAndPad(s);

  // DER: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
  const totalLen = 2 + rDer.length + 2 + sDer.length;
  const der = new Uint8Array(2 + totalLen);
  let offset = 0;
  der[offset++] = 0x30;
  der[offset++] = totalLen;
  der[offset++] = 0x02;
  der[offset++] = rDer.length;
  der.set(rDer, offset);
  offset += rDer.length;
  der[offset++] = 0x02;
  der[offset++] = sDer.length;
  der.set(sDer, offset);

  return der;
}

// --- Authorization Signature ---

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

  // Strip "wallet-auth:" prefix if present
  const privKeyBase64 = authKeyRaw.replace(/^wallet-auth:/, "");

  // Decode base64 to DER bytes (PKCS8 format)
  const privKeyDer = Uint8Array.from(atob(privKeyBase64), (c) => c.charCodeAt(0));

  // Import as ECDSA P-256 PKCS8 key
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privKeyDer.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Build the signature payload per Privy docs
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: {
      "privy-app-id": appId,
    },
  };

  // Canonicalize and encode
  const canonicalized = canonicalize(payload);
  console.log("[privy-auth] Canonicalized payload length:", canonicalized.length);
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(canonicalized);

  // Sign with ECDSA P-256 + SHA-256 (returns P1363 format)
  const signatureP1363 = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      payloadBytes
    )
  );

  // Convert P1363 to DER format (what Privy/Node.js expects)
  const signatureDer = p1363ToDer(signatureP1363);

  // Return base64-encoded DER signature
  return btoa(String.fromCharCode(...signatureDer));
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
 * Uses api.privy.io for wallet operations (per Privy docs).
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  rpcUrl: string
): Promise<string> {
  // Privy docs specify api.privy.io for wallet RPC calls
  const url = `${PRIVY_WALLET_API_BASE}/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signAndSendTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

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
 * Uses api.privy.io for wallet operations (per Privy docs).
 */
export async function signTransaction(
  walletId: string,
  serializedTransaction: string
): Promise<string> {
  const url = `${PRIVY_WALLET_API_BASE}/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

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
