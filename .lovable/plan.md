
# Plan: Disable Fresh Deployer for Trading Agent Token Launches

## Problem
The current token launch system (`api/pool/create-fun.ts`) always uses the `USE_FRESH_DEPLOYER` flag from config, which:
1. Generates a new random Keypair for each launch
2. Funds it with 0.05 SOL from the treasury
3. Uses this fresh wallet as the deployer/fee payer

This is problematic for trading agent launches because it wastes SOL and adds unnecessary complexity. You want trading agent tokens to deploy directly from the main treasury wallet.

---

## Solution
Add a `useFreshDeployer` parameter to the API that allows callers to override the global config. The trading-agent-create function will pass `useFreshDeployer: false` to deploy directly from treasury.

---

## Technical Changes

### 1. `api/pool/create-fun.ts` — Add parameter to control fresh deployer

**Current behavior (line ~305):**
```typescript
if (USE_FRESH_DEPLOYER) {
  deployerKeypair = await fundFreshDeployer(...);
}
```

**New behavior:**
```typescript
// Accept useFreshDeployer from request body, default to global config
const { useFreshDeployer = USE_FRESH_DEPLOYER } = req.body;

if (useFreshDeployer) {
  deployerKeypair = await fundFreshDeployer(...);
}
```

This change:
- Adds `useFreshDeployer` as an optional request parameter
- Defaults to the global `USE_FRESH_DEPLOYER` config if not specified
- Allows individual callers to opt-out by passing `useFreshDeployer: false`

### 2. `supabase/functions/trading-agent-create/index.ts` — Pass flag to disable fresh deployer

**Change the launch call (line ~140):**
```typescript
const launchResponse = await fetch(`${VERCEL_API_URL}/api/pool/create-fun`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: finalName,
    ticker: finalTicker,
    description: finalDescription,
    imageUrl: finalAvatarUrl,
    websiteUrl,
    twitterUrl: finalTwitterUrl,
    serverSideSign: true,
    agentId: agent.id,
    useFreshDeployer: false,  // ADD THIS - Deploy from treasury directly
  }),
});
```

---

## Files to Modify

| File | Change |
|------|--------|
| `api/pool/create-fun.ts` | Add `useFreshDeployer` parameter extraction (line ~238), use it instead of global config (line ~305) |
| `supabase/functions/trading-agent-create/index.ts` | Add `useFreshDeployer: false` to the launch request body (line ~143) |

---

## Benefits
1. **Saves SOL**: No 0.05 SOL funding per trading agent token launch
2. **Cleaner attribution**: Trading agent tokens are clearly deployed by the treasury
3. **Backward compatible**: Existing launches still use fresh deployer by default
4. **Simple change**: Only 2 files, minimal code changes

---

## Testing
After implementation:
1. Create a new trading agent via the UI
2. Check the console logs — should NOT show "Generating fresh deployer wallet..."
3. Verify the token's `creator_wallet` in the database matches the treasury address
4. Confirm on Solscan that the transaction fee payer is the treasury wallet
