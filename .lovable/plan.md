
# Token Promotion System - Complete Implementation

## Overview
Implement a fully automated token promotion system where:
1. Each token gets a unique Solana wallet address for payment
2. Users send 1 SOL to promote their token
3. System auto-detects the payment and forwards SOL to treasury wallet
4. Token is promoted on X (Twitter) automatically
5. Token appears in the "Promoted" section for 24 hours

The treasury wallet for all promotion payments: `FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r`

## Current State Analysis
The promotion system already has:
- `token_promotions` table with payment address storage
- `promote-generate` function that creates payment wallets
- `promote-check` function that monitors balance
- `promote-post` function that posts to Twitter
- Frontend UI with promote modal and promoted tokens tab

## Missing Functionality
1. **SOL forwarding** - Payment not being forwarded to treasury after detection
2. **Treasury wallet configuration** - Need to ensure consistent wallet usage

## Implementation Plan

### 1. Update `promote-check` Edge Function
**File:** `supabase/functions/promote-check/index.ts`

Add SOL forwarding logic after payment is confirmed:

```text
When payment detected (balance >= 1 SOL):
1. Get private key from token_promotions record
2. Create transfer transaction from payment wallet to treasury
3. Sign and send transaction
4. Store signature in database
5. Trigger Twitter post
```

Changes:
- Add import for `Keypair`, `Transaction`, `SystemProgram`, `sendAndConfirmTransaction`
- Query `payment_private_key` from the promotion record (using service role key)
- Create SOL transfer to treasury: `FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r`
- Handle rent-exempt balance (keep ~0.002 SOL for account)
- Update promotion record with transfer signature

### 2. Update Database Query for Private Key
**File:** `supabase/functions/promote-check/index.ts`

Modify the select query to include the `payment_private_key` column (only accessible via service role):
```typescript
.select(`
  id,
  fun_token_id,
  payment_address,
  payment_private_key,  // Add this
  status,
  created_at,
  fun_tokens (...)
`)
```

### 3. Create SOL Transfer Logic
Add function to forward SOL from payment wallet to treasury:

```typescript
async function forwardToTreasury(
  connection: Connection,
  paymentPrivateKey: string,
  balance: number
): Promise<string> {
  const keypair = Keypair.fromSecretKey(bs58.decode(paymentPrivateKey));
  const treasuryPubkey = new PublicKey("FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r");
  
  // Keep 0.002 SOL for rent-exempt
  const transferAmount = Math.floor((balance - 0.002) * LAMPORTS_PER_SOL);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: treasuryPubkey,
      lamports: transferAmount,
    })
  );
  
  // Send with confirmation
  const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
  return signature;
}
```

### 4. Update Promotion Status with Signature
Modify the `backend_update_promotion_status` RPC call to include the transfer signature:

```typescript
await supabase.rpc("backend_update_promotion_status", {
  p_promotion_id: promotionId,
  p_status: "paid",
  p_signature: transferSignature,
});
```

## Flow Diagram

```text
User clicks "Promote" on token
        ↓
Frontend calls promote-generate
        ↓
Generate new Solana keypair
Store pubkey + private key in DB
        ↓
Show payment QR + address to user
        ↓
User sends 1 SOL to payment address
        ↓
Frontend polls promote-check every 5s
        ↓
promote-check detects balance >= 1 SOL
        ↓
Forward SOL to treasury wallet
Store transfer signature
        ↓
Call promote-post to tweet
        ↓
Token appears in "Promoted" tab for 24h
```

## Technical Details

### Treasury Wallet
- Address: `FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r`
- Already configured as `PLATFORM_FEE_WALLET` in lib/config.ts

### Edge Function Changes

**promote-check/index.ts updates:**
1. Add imports: `Keypair`, `Transaction`, `SystemProgram`, `sendAndConfirmTransaction`
2. Add `bs58` import for private key decoding
3. Query `payment_private_key` in promotion select
4. After balance check passes:
   - Reconstruct keypair from private key
   - Create transfer transaction to treasury
   - Send and confirm transaction
   - Store signature in DB
   - Proceed with Twitter post

### Error Handling
- If SOL transfer fails, mark promotion as "failed" with error details
- Log all transfer attempts for debugging
- Retry logic: if transfer fails, keep promotion in "pending" state for retry

### Security Considerations
- Private keys are stored encrypted in DB (payment_private_key column)
- Only service role key can access private keys
- Keys are only used once to forward funds, then become unused
- Treasury wallet is the same as platform fee wallet for consistency

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/promote-check/index.ts` | Add SOL forwarding logic, import bs58 and additional web3.js classes |

## Summary
This implementation completes the token promotion flow by:
1. Forwarding 1 SOL payments to the treasury wallet automatically
2. Recording transfer signatures for auditing
3. Triggering X/Twitter posts upon successful payment
4. Displaying promoted tokens in the dedicated "Promoted" tab with 24h countdown

