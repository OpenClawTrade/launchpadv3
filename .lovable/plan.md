

# Remove Wallet Requirement from Trading Agent Creation

## Summary
Remove the unnecessary wallet connection requirement from the Trading Agent creation flow. Currently, the `creatorWallet` is validated but never actually used - the trading agent generates its own wallet for trading. Creation should be completely free and open, just like standard TUNA agents.

## Current State (Problem)
- Modal shows "Connect wallet to create a trading agent" if not authenticated
- `onSubmit` checks for `solanaAddress` and blocks submission without it
- Backend requires `creatorWallet` but doesn't store or use it anywhere
- Trading agents generate their own wallets for autonomous trading

## Changes

### 1. Frontend: `src/components/trading/CreateTradingAgentModal.tsx`

**Remove wallet checks:**
- Remove the `!isAuthenticated` conditional block showing "Connect wallet" message
- Remove the `if (!solanaAddress)` check in `onSubmit`
- Remove `creatorWallet` from the API call (or make it optional)
- Keep the form always visible regardless of auth state

```text
Before:
- Line 75: uses { solanaAddress, login, isAuthenticated } from useAuth()
- Lines 106-113: blocks submission if no solanaAddress
- Line 122: passes creatorWallet: solanaAddress
- Lines 228-234: shows "Connect wallet" button if not authenticated

After:
- Remove isAuthenticated check - show form directly
- Remove solanaAddress requirement in onSubmit
- Make creatorWallet optional in API call
- Anyone can create an agent for free
```

### 2. Backend: `supabase/functions/trading-agent-create/index.ts`

**Make creatorWallet optional:**
- Remove the required validation for `creatorWallet` (lines 44-49)
- Keep the field optional for potential future use (creator tracking)
- Store it if provided, but don't require it

```text
Before (lines 44-49):
if (!creatorWallet) {
  return new Response(
    JSON.stringify({ error: "creatorWallet is required" }),
    ...
  );
}

After:
// creatorWallet is optional - can be used for creator tracking if provided
// Trading agent uses its own generated wallet for trading
```

### 3. Hook: `src/hooks/useTradingAgents.ts`

**Update CreateAgentInput interface:**
```typescript
// Make creatorWallet optional in the type
export interface CreateAgentInput {
  name?: string;
  ticker?: string;
  description?: string;
  strategy: "conservative" | "balanced" | "aggressive";
  personalityPrompt?: string;
  creatorWallet?: string; // Now optional
}
```

## Result
- Anyone can create a trading agent without connecting a wallet
- Creation is completely free
- The trading agent still gets its own generated wallet for trading
- The `creatorWallet` field remains optional for future creator tracking/fee distribution features

## Files to Modify
| File | Change |
|------|--------|
| `src/components/trading/CreateTradingAgentModal.tsx` | Remove wallet requirement checks, show form directly |
| `supabase/functions/trading-agent-create/index.ts` | Make creatorWallet optional instead of required |
| `src/hooks/useTradingAgents.ts` | Make creatorWallet optional in CreateAgentInput type |

