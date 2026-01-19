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
]);

// Filter function to remove hidden tokens from any array
export function filterHiddenTokens<T extends { id: string }>(tokens: T[]): T[] {
  return tokens.filter(token => !HIDDEN_TOKEN_IDS.has(token.id));
}
