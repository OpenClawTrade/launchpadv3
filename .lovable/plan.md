
# Fix Agent Token Launch Reliability

## Problem Summary
Agent-launched tokens (via X mentions) are being marked as successful and listed on the site even when the on-chain transactions fail to land. This happened with **TunaKing ($KNGT)** - it appears in the database with `status: active` but doesn't exist on-chain.

## Root Cause Analysis
The `api/pool/create-fun.ts` Vercel endpoint uses a "fire and forget" approach:

```text
┌──────────────────────────────────────────────────────────┐
│  CURRENT FLOW (BROKEN)                                   │
├──────────────────────────────────────────────────────────┤
│  1. Send TX1 (Config) → No wait                          │
│  2. Wait 50ms                                            │
│  3. Send TX2 (Pool) → No wait                            │
│  4. Insert to database immediately                       │
│  5. Return success: true                                 │
│                                                          │
│  ❌ If TX1 or TX2 fails, database is already polluted    │
└──────────────────────────────────────────────────────────┘
```

## Solution: Confirm Transactions Before Database Insert

```text
┌──────────────────────────────────────────────────────────┐
│  NEW FLOW (RELIABLE)                                     │
├──────────────────────────────────────────────────────────┤
│  1. Send TX1 (Config)                                    │
│  2. Wait for TX1 confirmation (with retries)             │
│  3. Send TX2 (Pool)                                      │
│  4. Wait for TX2 confirmation (with retries)             │
│  5. Verify pool exists on-chain                          │
│  6. ONLY THEN: Insert to database                        │
│  7. Return success: true                                 │
│                                                          │
│  ✅ If any step fails, return error (no DB pollution)    │
└──────────────────────────────────────────────────────────┘
```

## Technical Implementation

### 1. Add Transaction Confirmation Helper (`api/pool/create-fun.ts`)
Create a robust confirmation function with exponential backoff:
- **Max retries**: 5 attempts
- **Timeout per attempt**: 30 seconds
- **Backoff**: 1s → 2s → 4s → 8s → 16s
- **Commitment**: `confirmed` (25+ validators)

### 2. Sequential Transaction Execution with Confirmation
Instead of:
```typescript
// Current: Fire and forget
const signature = await connection.sendRawTransaction(tx.serialize(), {...});
signatures.push(signature);
await new Promise(r => setTimeout(r, 50)); // Too short!
```

New approach:
```typescript
// Step 1: Send TX1 (Config)
const sig1 = await connection.sendRawTransaction(configTx.serialize(), {...});
await confirmTransaction(connection, sig1, 'confirmed', 30000);

// Step 2: Only after TX1 confirmed, send TX2 (Pool)  
const sig2 = await connection.sendRawTransaction(poolTx.serialize(), {...});
await confirmTransaction(connection, sig2, 'confirmed', 30000);

// Step 3: Verify pool actually exists on-chain
const poolAccount = await connection.getAccountInfo(poolAddress);
if (!poolAccount) throw new Error('Pool account not found after confirmation');
```

### 3. Increase Priority Fees for Agent Launches
Agent launches are critical - increase priority to ensure they land:
- **Current**: 100,000 microlamports/CU
- **New**: 500,000 microlamports/CU (5x higher)
- Consider Jito bundles for guaranteed inclusion

### 4. Add Retry Logic for Full Launch Flow
If the entire launch fails, retry up to 2 times with fresh blockhash:
```typescript
const MAX_LAUNCH_RETRIES = 2;
for (let attempt = 0; attempt < MAX_LAUNCH_RETRIES; attempt++) {
  try {
    // Fetch fresh blockhash each attempt
    const blockhash = await getBlockhashWithRetry(connection);
    // Execute sequential confirmed transactions
    // If all succeed, break out of retry loop
    break;
  } catch (error) {
    if (attempt === MAX_LAUNCH_RETRIES - 1) throw error;
    await sleep(2000 * Math.pow(2, attempt)); // Backoff
  }
}
```

### 5. Update Agent-Process-Post Error Handling
Ensure failures propagate correctly:
- On Vercel API failure → mark `agent_social_posts.status = 'failed'`
- On success but no pool → mark as failed with specific error
- Don't create SubTuna community until token is confirmed live

## Files to Modify

| File | Changes |
|------|---------|
| `api/pool/create-fun.ts` | Add confirmation logic, increase priority fees, add retries |
| `supabase/functions/agent-process-post/index.ts` | Add post-launch verification, better error handling |

## Risk Mitigation
- **Timeout handling**: If confirmation takes too long, return specific error (not generic 500)
- **Vanity address release**: Already handled on error
- **Rate limit**: Still enforced before any on-chain work

## Expected Outcome
- ✅ Tokens only appear on site after confirmed on-chain
- ✅ Failed launches clearly marked with error in `agent_social_posts`
- ✅ Higher priority ensures agent transactions land reliably
- ✅ Automatic retry handles transient RPC issues
