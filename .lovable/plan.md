
# Partner Fee Splitting Implementation Plan

## Overview
This plan implements a time-limited (3 weeks) partner fee-sharing arrangement where the platform's share of trading fees is split 50/50 with a partner wallet across all launch modes.

**Partner Wallet:** `7Tegs2EwsK8icYHHryFvv5FwNxhQJMp2HhM2zVTq9uBh`  
**Duration:** 3 weeks from deployment (automatic expiration)

---

## Fee Structure Changes Summary

| Launch Mode | Before | After |
|-------------|--------|-------|
| **Random/Describe/Custom** | 1% Creator, 1% Platform | 1% Creator, 0.5% Platform, 0.5% Partner |
| **Phantom** | 50% Creator, 50% Platform | 50% Creator, 25% Platform, 25% Partner |
| **Standard Agents** | 80% Agent, 20% Platform | 80% Agent, 10% Platform, 10% Partner |
| **Trading Agents** | 50% Trading Wallet, 50% Platform | 50% Trading Wallet, 25% Platform, 25% Partner |
| **Holder Rewards** | 50% Holders, 50% Platform | 50% Holders, 25% Platform, 25% Partner |
| **Bags Agents** | 0% Creator, 100% Platform | 0% Creator, 50% Platform, 50% Partner |

---

## Implementation Tasks

### 1. Database Schema (Migration)

Create a new table `partner_fee_distributions` to track all partner payments:

```sql
CREATE TABLE IF NOT EXISTS partner_fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id),
  token_name TEXT,
  token_ticker TEXT,
  launchpad_type TEXT,
  fee_mode TEXT,
  amount_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_partner_fee_dist_created ON partner_fee_distributions(created_at DESC);
CREATE INDEX idx_partner_fee_dist_token ON partner_fee_distributions(fun_token_id);

-- RLS - read-only access (protected by password in app)
ALTER TABLE partner_fee_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access" ON partner_fee_distributions FOR ALL USING (true);
```

### 2. Edge Function Modification: `fun-distribute/index.ts`

**Key Changes:**

a) Add partner wallet constant and expiration date:
```typescript
// Partner fee split configuration (3 weeks from deployment)
const PARTNER_WALLET = "7Tegs2EwsK8icYHHryFvv5FwNxhQJMp2HhM2zVTq9uBh";
const PARTNER_SPLIT_EXPIRES = new Date("2026-02-27T00:00:00Z"); // 3 weeks from Feb 6

function isPartnerSplitActive(): boolean {
  return new Date() < PARTNER_SPLIT_EXPIRES;
}
```

b) Modify fee calculation logic for each token type:

**For Regular Tokens (Random/Describe/Custom):**
```typescript
// Currently: 50% creator, 50% platform
// New: 50% creator, 25% platform, 25% partner (if active)
if (isPartnerSplitActive()) {
  const partnerAmount = platformAmount * 0.5;
  platformAmount = platformAmount * 0.5;
  // Send partnerAmount to PARTNER_WALLET
  // Record in partner_fee_distributions
}
```

**For Agent Tokens:**
```typescript
// Currently: 80% agent, 20% platform
// New: 80% agent, 10% platform, 10% partner (if active)
if (isPartnerSplitActive()) {
  const partnerAmount = platformAmount * 0.5;
  platformAmount = platformAmount * 0.5;
  // Send and record partner share
}
```

**For Trading Agent Tokens:**
```typescript
// Currently: 50% to trading wallet, 50% platform (stays in treasury)
// New: 50% to trading wallet, 25% platform, 25% partner
if (isPartnerSplitActive()) {
  const partnerAmount = platformAmount * 0.5;
  // Send and record partner share
}
```

c) Add helper function to send partner fees:
```typescript
async function sendPartnerFee(
  connection: Connection,
  treasuryKeypair: Keypair,
  supabase: any,
  token: any,
  partnerAmount: number,
  launchpadType: string,
  feeMode: string
): Promise<{ success: boolean; signature?: string }> {
  if (partnerAmount < 0.001) return { success: true }; // Skip dust
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: new PublicKey(PARTNER_WALLET),
      lamports: Math.floor(partnerAmount * 1e9),
    })
  );
  
  const signature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);
  
  // Record in partner_fee_distributions
  await supabase.from("partner_fee_distributions").insert({
    fun_token_id: token.id,
    token_name: token.name,
    token_ticker: token.ticker,
    launchpad_type: launchpadType || 'tuna',
    fee_mode: feeMode || 'creator',
    amount_sol: partnerAmount,
    signature,
    status: 'completed',
  });
  
  return { success: true, signature };
}
```

### 3. New Page: `/partnerfees`

Create `src/pages/PartnerFeesPage.tsx`:

**Features:**
- Password protection with `partner777`
- Dashboard showing:
  - Total SOL earned (all time)
  - Today's earnings
  - This week's earnings  
  - This month's earnings
- Transaction list with:
  - Token name/ticker
  - Launch mode (Random/Phantom/Agent/etc)
  - Amount SOL
  - Time received (relative: "2 min ago")
  - Solscan link for transaction
- Date range filter
- Auto-refresh every 30 seconds
- Export to CSV

**Page Structure:**
```text
+----------------------------------+
|  [Lock Icon] Partner Earnings    |
+----------------------------------+
|  [Password Input] [Login Button] |
+----------------------------------+

After Login:

+----------------------------------+
|  Partner Dashboard               |
+----------------------------------+
|  +--------+  +--------+  +------+|
|  | Today  |  | Week   |  |Month ||
|  | 0.5SOL |  | 2.1SOL |  |8.4SOL||
|  +--------+  +--------+  +------+|
|                                  |
|  +--------+                      |
|  | TOTAL  |                      |
|  | 42.5SOL|                      |
|  +--------+                      |
+----------------------------------+
|  Recent Transactions             |
|  +------------------------------+|
|  | Token    | Type  | SOL | Time||
|  | PEPE     | Random| 0.01| 2m  ||
|  | DOGE     |Phantom| 0.05| 5m  ||
|  | SHIBA    | Agent | 0.02| 10m ||
|  +------------------------------+|
+----------------------------------+
```

### 4. Add Route to App.tsx

```typescript
const PartnerFeesPage = lazy(() => import("./pages/PartnerFeesPage"));

// In Routes:
<Route path="/partnerfees" element={<PartnerFeesPage />} />
```

---

## Technical Details

### Expiration Logic
The partner split will automatically stop after 3 weeks. The `isPartnerSplitActive()` function checks the current date against the expiration timestamp. After expiration:
- No code changes needed
- Fee distribution reverts to original splits automatically
- Historical records remain in `partner_fee_distributions` for auditing

### Transaction Safety
- Partner fee transfers use the same retry logic as creator distributions
- Each transfer is recorded atomically with its signature
- Failed transfers don't block other distributions

### Minimum Threshold
- Partner fees below 0.001 SOL are skipped to avoid dust transactions
- These micro-amounts remain in treasury

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/fun-distribute/index.ts` | Modify | Add partner fee splitting logic |
| `src/pages/PartnerFeesPage.tsx` | Create | New password-protected dashboard |
| `src/App.tsx` | Modify | Add /partnerfees route |
| Database migration | Create | Add `partner_fee_distributions` table |

---

## Security Considerations

1. **Partner page password** (`partner777`) stored in component - suitable for simple access control
2. **Partner wallet hardcoded** in edge function - not configurable at runtime
3. **Time limit hardcoded** - prevents accidental extension
4. **All transactions recorded** with blockchain signatures for full audit trail
