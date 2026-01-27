// Token IDs that should be hidden from all lists (spam/exploit tokens)
export const HIDDEN_TOKEN_IDS = new Set([
  // "WE FOUND AN EXPLOIT IN UR WEBSITE" spam tokens
  "892f1e29-73f8-4d88-9c5a-c679027cd2d4",
  "57ef93a5-51e7-487a-a89d-59b75590477e",
  "7e7da8b9-3d45-45fc-882c-c1600b4bcb22",
  "4c8af6ac-8537-47aa-b082-f324884926ed",
  "150dee6a-3472-4509-bf29-011156509344",
  // "DM @0xh1ve AND FIX UR SITE" spam tokens
  "0a943756-9ffa-4f14-9f48-fc1d678d9e32",
  "2ea2469c-e0f9-4ad4-8a11-fae0af31ecf2",
  "0dc14468-49ae-4a4b-9825-d956089dae1e",
  // RiftIsARug spam tokens
  "f0f00eea-2be8-46f6-94a7-cd1e7b27abba",
  "6406f5ba-b336-4682-b2e9-709c50bd7449",
]);

// Blocked words/phrases in token names and tickers (case-insensitive)
export const BLOCKED_PATTERNS = [
  /exploit/i,
  /hack/i,
  /0xh1ve/i,
  /fix\s*(ur|your)\s*site/i,
  /dm\s*@/i,
  /found\s*(an?|the)?\s*exploit/i,
  /vulnerability/i,
  /security\s*issue/i,
  /into\s*(ur|your)\s*db/i,
  /rug/i,
];

// Check if a name or ticker contains blocked content
export function isBlockedName(name: string): boolean {
  if (!name) return false;
  return BLOCKED_PATTERNS.some(pattern => pattern.test(name));
}

// Filter function to remove hidden tokens from any array (by ID or by name/ticker)
export function filterHiddenTokens<T extends { id: string; name?: string; ticker?: string }>(tokens: T[]): T[] {
  return tokens.filter(token => {
    // Filter by ID
    if (HIDDEN_TOKEN_IDS.has(token.id)) return false;
    // Filter by name pattern
    if (token.name && isBlockedName(token.name)) return false;
    // Filter by ticker pattern
    if (token.ticker && isBlockedName(token.ticker)) return false;
    return true;
  });
}
