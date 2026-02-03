
# Plan: Fresh Deployer Wallet per Token Launch

## Overview
Implement a system where each token launch uses a **fresh, randomly generated Solana wallet** as the deployer/creator, rather than using the central treasury wallet for all launches. This provides several benefits:
- Better on-chain attribution (each token has unique deployer)
- Reduced concentration of transactions from a single wallet
- Isolation of individual launches for audit purposes
- Prevents wallet clustering patterns

## Architecture Changes

### Current Flow
```text
User Request → Treasury Wallet signs & pays → Token Created → All tokens show same deployer
```

### New Flow
```text
User Request → Generate Fresh Wallet → Fund from Treasury → Fresh Wallet deploys → Token Created
                                                                ↓
                                                   Fee receiver stays = Treasury/Platform
                                                                ↓
                                            Leftover funds returned to Treasury (optional)
```

---

## Technical Implementation

### Phase 1: Fresh Wallet Generation and Funding

**File: `api/pool/create-fun.ts`**

Add new logic at the start of the launch flow:

1. **Generate Fresh Deployer Wallet**
   ```
   - Generate new Keypair: deployerKeypair = Keypair.generate()
   - Calculate required SOL for launch (approximately 0.05 SOL):
     - Transaction fees: ~0.00001 SOL per tx × 2-3 txs
     - Priority fees: ~0.04 SOL (400k CU × 100 microlamports × 2 txs)
     - Rent: ~0.003 SOL (token mint, config accounts)
     - Buffer: +0.01 SOL for safety
   ```

2. **Fund Fresh Wallet from Treasury**
   ```
   - Create SystemProgram.transfer from treasury → freshDeployer
   - Amount: LAUNCH_FUNDING_SOL (e.g., 0.05 SOL)
   - Sign with treasury keypair
   - Send and confirm transaction
   ```

3. **Use Fresh Wallet as Deployer**
   ```
   - Set tx.feePayer = deployerKeypair.publicKey
   - Add deployerKeypair to available signers map
   - Execute launch transactions as normal
   ```

### Phase 2: Record Deployer Wallet Association

**Database Migration**

Add `deployer_wallet` column to `fun_tokens` table:
```sql
ALTER TABLE fun_tokens 
ADD COLUMN deployer_wallet text;

CREATE INDEX idx_fun_tokens_deployer_wallet 
ON fun_tokens(deployer_wallet);

COMMENT ON COLUMN fun_tokens.deployer_wallet IS 
'Fresh wallet generated and funded per-launch for on-chain deployment';
```

**After Launch Success**
- Store `deployer_wallet` = freshDeployer.publicKey in database
- This allows tracking which wallet deployed each token

### Phase 3: Fee Receiver Configuration (No Change)

The **fee receiver** (the wallet that receives trading fees) remains unchanged:
- `feeClaimer` in Meteora config = `PLATFORM_FEE_WALLET` (treasury)
- `leftoverReceiver` = user wallet (for Phantom) or treasury (for server-side)

This means:
- Trading fees continue to flow to the platform treasury
- Only the **deployer/creator** address changes per token

### Phase 4: Optional - Sweep Leftover Funds

After successful launch, the fresh wallet may have remaining SOL. Two options:

**Option A: Leave it (Simplest)**
- Fresh wallet keeps ~0.01 SOL leftover
- Cost: ~0.01 SOL per launch (acceptable)

**Option B: Sweep back to Treasury (Efficient)**
- After launch confirmation, calculate remaining balance
- Transfer (balance - rent_exempt_minimum) back to treasury
- Adds 1 extra transaction but recovers most funds

Recommended: **Option A** for simplicity. The ~0.01 SOL cost per launch is negligible.

---

## Implementation Details

### New Helper Function

**File: `api/pool/create-fun.ts`**

```typescript
async function fundFreshDeployer(
  connection: Connection,
  treasuryKeypair: Keypair,
  amount: number = 0.05
): Promise<Keypair> {
  const deployerKeypair = Keypair.generate();
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: deployerKeypair.publicKey,
      lamports: Math.floor(amount * LAMPORTS_PER_SOL),
    })
  );
  
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = treasuryKeypair.publicKey;
  
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [treasuryKeypair],
    { commitment: 'confirmed' }
  );
  
  console.log(`[create-fun] Funded fresh deployer ${deployerKeypair.publicKey.toBase58()} with ${amount} SOL (tx: ${signature.slice(0,16)}...)`);
  
  return deployerKeypair;
}
```

### Modified Launch Logic

**File: `api/pool/create-fun.ts`**

Replace:
```typescript
const treasuryKeypair = getTreasuryKeypair();
// ... later ...
tx.feePayer = treasuryKeypair.publicKey;
```

With:
```typescript
const treasuryKeypair = getTreasuryKeypair();

// Generate and fund fresh deployer wallet
console.log(`[create-fun] Generating fresh deployer wallet...`);
const deployerKeypair = await fundFreshDeployer(connection, treasuryKeypair, 0.05);
const deployerAddress = deployerKeypair.publicKey.toBase58();
console.log(`[create-fun] Fresh deployer ready: ${deployerAddress}`);

// ... in transaction loop ...
tx.feePayer = deployerKeypair.publicKey;

// ... in keypair map ...
const availableKeypairs: Map<string, Keypair> = new Map([
  [deployerKeypair.publicKey.toBase58(), deployerKeypair], // NEW: fresh deployer
  [mintKeypair.publicKey.toBase58(), mintKeypair],
  [configKeypair.publicKey.toBase58(), configKeypair],
]);
```

### Update Meteora Pool Creation

**File: `lib/meteora.ts`**

The `createMeteoraPool` and `createMeteoraPoolWithMint` functions take `creatorWallet` as parameter. This will now be the fresh deployer address instead of treasury.

No changes needed to meteora.ts - just pass different wallet from caller.

### Update agent-launch Edge Function

**File: `supabase/functions/agent-launch/index.ts`**

No changes needed - it calls `api/pool/create-fun` which handles fresh wallet internally.

### Database Update After Launch

```typescript
// After successful launch
const { error: tokenError } = await supabase.rpc('backend_create_token', {
  // ... existing params ...
  p_creator_wallet: deployerAddress, // Fresh deployer, not treasury
  p_deployer_wallet: deployerAddress, // New column
  // NOTE: feeRecipientWallet remains = treasury for fee distribution
});
```

---

## Configuration Constants

Add to `lib/config.ts`:
```typescript
// Fresh deployer wallet funding per launch
export const LAUNCH_FUNDING_SOL = 0.05; // SOL to fund each fresh deployer
export const USE_FRESH_DEPLOYER = true; // Feature flag
```

---

## Files to Modify

| File | Change |
|------|--------|
| `api/pool/create-fun.ts` | Add fresh wallet generation, funding, and use as deployer |
| `lib/config.ts` | Add LAUNCH_FUNDING_SOL constant |
| `supabase/migrations/` | Add deployer_wallet column to fun_tokens |

---

## Cost Analysis

Per launch with fresh deployer:
- Funding transaction: ~0.000005 SOL (5000 lamports base fee)
- Transfer amount: 0.05 SOL
- Actual launch costs: ~0.03-0.04 SOL
- Leftover in fresh wallet: ~0.01 SOL

**Net cost increase per launch**: ~0.01 SOL (funding tx fee + leftover)

With ~10 launches/day, additional cost: ~0.1 SOL/day = ~$15/month at $150 SOL

---

## Security Considerations

1. **Private Key Handling**: Fresh deployer keypairs are generated in memory, used once, and discarded. No need to persist them.

2. **Fee Receiver Protection**: Trading fees always go to platform treasury regardless of deployer. No risk of fee misdirection.

3. **Audit Trail**: `deployer_wallet` column in database links each token to its one-time deployer for forensics.

4. **No Rug Risk**: Fresh wallets have no authority over tokens after launch. All LP locked to platform treasury.

---

## Testing Plan

1. Deploy to staging
2. Launch test token via agent-launch
3. Verify on Solscan:
   - New unique "Creator" address for each token
   - Fee recipient still = treasury
   - Transactions funded correctly
4. Check database: deployer_wallet populated
5. Launch 3+ tokens and confirm all have different deployers
