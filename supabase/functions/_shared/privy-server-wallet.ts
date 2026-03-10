/**
 * Privy Server Wallet Helper
 * 
 * Uses the official @privy-io/node SDK which handles
 * authorization signatures automatically.
 * 
 * Docs: https://docs.privy.io/basics/nodeJS/quickstart
 */

import { PrivyClient } from "npm:@privy-io/node@1";

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

// --- Privy Client Singleton ---

let _privyClient: InstanceType<typeof PrivyClient> | null = null;

function getPrivyClient(): InstanceType<typeof PrivyClient> {
  if (_privyClient) return _privyClient;

  const appId = Deno.env.get("PRIVY_APP_ID");
  const appSecret = Deno.env.get("PRIVY_APP_SECRET");
  const authorizationKey = Deno.env.get("PRIVY_AUTHORIZATION_KEY");

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
  }

  const clientOptions: Record<string, unknown> = {
    appId,
    appSecret,
  };

  // Add authorization key if available
  if (authorizationKey) {
    clientOptions.authorizationPrivateKey = authorizationKey;
    console.log("[privy] Client initialized with authorization key");
  } else {
    console.log("[privy] Client initialized without authorization key");
  }

  _privyClient = new PrivyClient(clientOptions as any);
  return _privyClient;
}

// --- Legacy Auth Headers (for user lookup endpoints that don't need auth sig) ---

const PRIVY_API_BASE = "https://auth.privy.io";

function getAuthHeaders(): Record<string, string> {
  const appId = Deno.env.get("PRIVY_APP_ID");
  const appSecret = Deno.env.get("PRIVY_APP_SECRET");
  if (!appId || !appSecret) throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
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
 * Sign and send a Solana transaction using the @privy-io/node SDK.
 * The SDK handles authorization signatures automatically.
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  _rpcUrl: string
): Promise<string> {
  const privy = getPrivyClient();
  
  console.log("[privy] Calling signAndSendTransaction via SDK for wallet:", walletId);

  const response = await (privy as any).wallets().solana().signAndSendTransaction(walletId, {
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    transaction: serializedTransaction,
  });

  console.log("[privy] SDK signAndSendTransaction response:", JSON.stringify(response));
  return response.hash || response.signature;
}

/**
 * Sign a Solana transaction without sending.
 */
export async function signTransaction(
  walletId: string,
  serializedTransaction: string
): Promise<string> {
  const privy = getPrivyClient();

  console.log("[privy] Calling signTransaction via SDK for wallet:", walletId);

  const response = await (privy as any).wallets().solana().signTransaction(walletId, {
    transaction: serializedTransaction,
  });

  console.log("[privy] SDK signTransaction response:", JSON.stringify(response));
  return response.signed_transaction || response.signedTransaction;
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
