

# Fix: Token Holdings Not Being Saved After Swap

## Problem Identified

The swap edge function has a **silent failure** in the token holdings insert. Here's what happens:

1. User buys 0.05 SOL worth of tokens -- WORKS
2. Token reserves update in database -- WORKS  
3. Transaction record is saved (with FK retry logic) -- WORKS
4. **Token holdings insert fails silently** because `profile_id` references a non-existent profile -- BROKEN
5. User sees "Buy successful!" but their token balance stays at 0

Evidence from logs:
- TX insert shows: `"TX insert failed, retrying without profile_id"` (retry logic exists here)
- But `token_holdings` table has **zero records** for wallet `DrWkWu7Mhv9V7Dt2iqxpjuwPfehmQq1DrkEQ39sqX8jV`
- The holdings insert has NO retry logic for FK failures

## Fix Plan

### 1. Fix Edge Function (`supabase/functions/launchpad-swap/index.ts`)

Add the same FK-safe retry pattern to ALL `token_holdings` operations (both insert and update paths for buy and sell):

```text
// Current (broken):
await supabase.from("token_holdings").insert({
  token_id: token.id,
  wallet_address: userWallet,
  profile_id: profileId || null,  // <-- fails silently if FK missing
  balance: tokensOut,
});

// Fixed:
const { error: holdingInsertError } = await supabase.from("token_holdings").insert({
  token_id: token.id,
  wallet_address: userWallet,
  profile_id: profileId || null,
  balance: tokensOut,
});

if (holdingInsertError) {
  // Retry without profile_id if FK constraint fails
  console.warn("[launchpad-swap] Holdings insert failed, retrying without profile_id:", holdingInsertError.message);
  await supabase.from("token_holdings").insert({
    token_id: token.id,
    wallet_address: userWallet,
    profile_id: null,
    balance: tokensOut,
  });
}
```

Apply this same pattern to all 3 holdings operations in the function:
- Buy: new holding insert
- Buy: existing holding update  
- Sell: existing holding update

### 2. Fix Existing Missing Holdings (Database Migration)

Insert the missing holdings for the 2 completed buy transactions that never got holdings records:

```sql
-- Credit the missing token balance from the 2 successful buys
INSERT INTO token_holdings (token_id, wallet_address, profile_id, balance)
VALUES (
  '8718bbbb-eefe-4546-a629-bbe05f7aceb7',
  'DrWkWu7Mhv9V7Dt2iqxpjuwPfehmQq1DrkEQ39sqX8jV',
  NULL,
  3256030.3010166883  -- sum of 1625360.40 + 1630669.91 from the 2 buys
)
ON CONFLICT (token_id, wallet_address) 
DO UPDATE SET balance = EXCLUDED.balance;
```

### 3. Redeploy Edge Function

Deploy the updated `launchpad-swap` function to ensure all future trades correctly save holdings.

## Summary

- Root cause: `profile_id` FK constraint silently kills the holdings insert
- The transaction retry was fixed previously but the holdings insert was missed
- This affects ALL users whose Privy ID hasn't been synced to the `profiles` table yet
- After this fix, every successful swap will always record the token balance correctly

