/**
 * Centralized BSC RPC URL helper.
 * Frontend calls go through the edge function proxy which uses Alchemy.
 */
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ptwytypavumcrbofspno";

export const BSC_RPC_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/bsc-rpc`;

/**
 * Make a JSON-RPC call to BSC via the Alchemy proxy.
 */
export async function bscRpcCall(method: string, params: unknown[] = []): Promise<any> {
  const res = await fetch(BSC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return res.json();
}

/**
 * Fetch BNB balance for an address via Alchemy.
 */
export async function fetchBnbBalance(address: string): Promise<number> {
  const data = await bscRpcCall("eth_getBalance", [address, "latest"]);
  if (data?.result) {
    return Number(BigInt(data.result)) / 1e18;
  }
  return 0;
}
