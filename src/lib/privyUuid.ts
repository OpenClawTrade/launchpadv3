// Deterministic mapping from Privy user IDs (e.g. "did:privy:...") to UUIDs.
// This lets us use Privy auth with a backend schema that expects UUID primary keys.

const UUID_V5_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID");

  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  // crypto.subtle.digest typings can be picky about ArrayBuffer vs SharedArrayBuffer.
  // Pass a real ArrayBuffer slice to keep TS + runtime happy.
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", ab);
  return new Uint8Array(digest);
}

async function uuidV5(name: string, namespaceUuid: string): Promise<string> {
  const ns = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);

  const toHash = new Uint8Array(ns.length + nameBytes.length);
  toHash.set(ns, 0);
  toHash.set(nameBytes, ns.length);

  const hash = await sha1(toHash);
  const bytes = hash.slice(0, 16);

  // Version 5
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Variant RFC4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

export async function privyUserIdToUuid(privyUserId: string): Promise<string> {
  return uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
}
