

# Holder Rewards Launch Option - Implementation Plan

## Overview

This plan implements a new token launch mode where the 50% creator fee share is redistributed proportionally to the top 50 token holders every 5 minutes, with a **0.3% minimum holding requirement** to qualify.

---

## Safety-First Architecture

### Core Financial Safeguards

| Risk | Mitigation |
|------|------------|
| Double-spending fees | Atomic DB transactions with snapshot locking before distribution |
| Dust attacks (many small wallets) | 0.3% of supply minimum to qualify (3,000,000 tokens for 1B supply) |
| Gas exceeds rewards | Minimum 0.05 SOL pool before distribution + batch transfers |
| Wrong recipients | Snapshot locked at distribution start, immutable during payout |
| Failed transactions | Pending state preserved; claims NOT marked distributed on failure |
| Treasury depletion | Pre-check balance; skip if insufficient for all payouts |
| Concurrent distributions | `cron_locks` table prevents overlapping runs |
| Invalid wallet addresses | Skip invalid wallets, redistribute share to valid holders |

### Distribution Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Minimum Holder Balance** | 0.3% of supply (3M tokens) | Prevents dust attack gaming |
| **Maximum Qualified Holders** | 50 | Gas cost control |
| **Minimum Pool Before Distribution** | 0.05 SOL | Avoid micro-transactions |
| **Minimum Per-Holder Payout** | 0.001 SOL | Prevent dust payouts |
| **Distribution Interval** | Every 5 minutes | As specified |
| **Split Method** | Proportional to holdings | Fairer to larger holders |

---

## Technical Implementation

### Phase 1: Database Schema Changes

**1.1 Add `fee_mode` column to `fun_tokens` table**

```sql
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS fee_mode TEXT DEFAULT 'creator';

COMMENT ON COLUMN public.fun_tokens.fee_mode 
IS 'Fee distribution mode: creator (50% to creator) or holder_rewards (50% to top 50 holders)';
```

**1.2 Create Holder Rewards Tables**

```sql
-- Accumulator for holder reward pool (per token)
CREATE TABLE public.holder_reward_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL UNIQUE,
  accumulated_sol NUMERIC NOT NULL DEFAULT 0,
  last_distribution_at TIMESTAMPTZ,
  total_distributed_sol NUMERIC DEFAULT 0,
  distribution_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Distribution snapshots (audit trail)
CREATE TABLE public.holder_reward_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pool_sol NUMERIC NOT NULL,
  qualified_holders INTEGER NOT NULL DEFAULT 0,
  min_balance_required NUMERIC NOT NULL,
  status TEXT DEFAULT 'locked', -- locked, distributing, completed, failed
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual holder payouts per snapshot
CREATE TABLE public.holder_reward_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES holder_reward_snapshots(id) ON DELETE CASCADE NOT NULL,
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  token_balance NUMERIC NOT NULL,
  balance_share NUMERIC NOT NULL, -- percentage of qualified holders' total
  payout_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, skipped
  signature TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies (read-only for public, full access for system)
ALTER TABLE holder_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_reward_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_reward_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pool" ON holder_reward_pool FOR SELECT USING (true);
CREATE POLICY "Anyone can view snapshots" ON holder_reward_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can view payouts" ON holder_reward_payouts FOR SELECT USING (true);

-- Backend management policies
CREATE POLICY "System manages pool" ON holder_reward_pool FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "System manages snapshots" ON holder_reward_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "System manages payouts" ON holder_reward_payouts FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_holder_pool_token ON holder_reward_pool(fun_token_id);
CREATE INDEX idx_holder_snapshots_token ON holder_reward_snapshots(fun_token_id);
CREATE INDEX idx_holder_snapshots_status ON holder_reward_snapshots(status);
CREATE INDEX idx_holder_payouts_snapshot ON holder_reward_payouts(snapshot_id);
CREATE INDEX idx_holder_payouts_wallet ON holder_reward_payouts(wallet_address);
```

---

### Phase 2: Modify Existing Distribution Logic

**File: `supabase/functions/fun-distribute/index.ts`**

Add logic to check `fee_mode` and route fees accordingly:

```typescript
// NEW: Check fee_mode for the token
const feeMode = token.fee_mode || 'creator';

if (feeMode === 'holder_rewards') {
  // Route 50% to holder_reward_pool instead of creator
  const holderAmount = claimedSol * 0.5;
  
  // Upsert into holder_reward_pool
  await supabase
    .from('holder_reward_pool')
    .upsert({
      fun_token_id: token.id,
      accumulated_sol: existingPool.accumulated_sol + holderAmount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fun_token_id' });
  
  // Mark claims as distributed (holders will be paid by separate cron)
  await supabase
    .from('fun_fee_claims')
    .update({ creator_distributed: true })
    .in('id', claimIds);
    
  continue; // Skip creator payment
}

// Existing creator distribution logic for fee_mode = 'creator'
```

---

### Phase 3: Create Holder Distribution Edge Function

**New File: `supabase/functions/fun-holder-distribute/index.ts`**

This function runs every 5 minutes and:

1. **Acquires Lock**: Uses `cron_locks` table to prevent concurrent runs
2. **Finds Ready Pools**: Tokens with `fee_mode = 'holder_rewards'` and `accumulated_sol >= 0.05`
3. **Fetches Top Holders**: Uses Helius RPC `getTokenLargestAccounts`
4. **Filters Qualified Holders**: Only those with >= 0.3% of supply (3M tokens)
5. **Creates Locked Snapshot**: Immutable record of holder balances at distribution time
6. **Calculates Proportional Shares**: Based on token balance
7. **Executes Batched Transfers**: Max 20 transfers per transaction
8. **Updates Records**: Marks snapshot complete, resets pool accumulator

**Key Algorithm (Pseudocode):**

```typescript
const TOTAL_SUPPLY = 1_000_000_000;
const MIN_BALANCE_PERCENT = 0.003; // 0.3%
const MIN_BALANCE = TOTAL_SUPPLY * MIN_BALANCE_PERCENT; // 3,000,000 tokens
const MIN_POOL_SOL = 0.05;
const MIN_PAYOUT_SOL = 0.001;
const MAX_HOLDERS = 50;
const MAX_TRANSFERS_PER_TX = 20;

async function distributeToHolders(token, poolSol) {
  // 1. LOCK: Create snapshot FIRST (no changes to holder list after this)
  const snapshot = await createLockedSnapshot(token.id, poolSol, MIN_BALANCE);
  
  try {
    // 2. Fetch top 50 holders via Helius
    const holders = await getTopHolders(token.mint_address, MAX_HOLDERS);
    
    // 3. Filter by minimum balance (0.3% = 3M tokens)
    const qualified = holders.filter(h => h.balance >= MIN_BALANCE);
    
    if (qualified.length === 0) {
      // No qualified holders - keep pool for next cycle
      await markSnapshotFailed(snapshot.id, 'No qualified holders');
      return;
    }
    
    // 4. Calculate total balance of qualified holders
    const totalBalance = qualified.reduce((sum, h) => sum + h.balance, 0);
    
    // 5. Calculate proportional payouts
    const payouts = qualified.map(h => ({
      wallet: h.address,
      balance: h.balance,
      share: h.balance / totalBalance,
      payout: (h.balance / totalBalance) * poolSol
    }));
    
    // 6. Filter out sub-minimum payouts
    const validPayouts = payouts.filter(p => p.payout >= MIN_PAYOUT_SOL);
    const skippedAmount = payouts
      .filter(p => p.payout < MIN_PAYOUT_SOL)
      .reduce((sum, p) => sum + p.payout, 0);
    
    // 7. Record payout records BEFORE sending
    for (const payout of validPayouts) {
      await createPayoutRecord(snapshot.id, token.id, payout);
    }
    
    // 8. Execute batched transfers
    const batches = chunk(validPayouts, MAX_TRANSFERS_PER_TX);
    for (const batch of batches) {
      const signature = await sendBatchTransfer(batch);
      await updatePayoutSignatures(batch, signature);
    }
    
    // 9. Reset pool, update snapshot as complete
    await resetPool(token.id, skippedAmount); // Keep skipped for next cycle
    await markSnapshotComplete(snapshot.id);
    
  } catch (error) {
    await markSnapshotFailed(snapshot.id, error.message);
    throw error;
  }
}
```

---

### Phase 4: Frontend Changes

**4.1 LaunchTokenForm.tsx - Add Fee Mode Selector**

Add a new section after Token Info:

```tsx
{/* Fee Distribution Mode */}
<div className="bg-card border border-border rounded-2xl p-5">
  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
    Fee Distribution
  </h3>
  
  <div className="space-y-3">
    <label className={cn(
      "flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all",
      feeMode === 'creator' 
        ? "bg-primary/10 border-2 border-primary" 
        : "bg-secondary/30 border-2 border-transparent hover:bg-secondary/50"
    )}>
      <input 
        type="radio" 
        name="feeMode" 
        value="creator" 
        checked={feeMode === 'creator'}
        onChange={() => setFeeMode('creator')}
        className="sr-only"
      />
      <div className="flex-1">
        <div className="font-medium">Creator Rewards</div>
        <div className="text-sm text-muted-foreground">
          You receive 50% of all trading fees
        </div>
      </div>
    </label>
    
    <label className={cn(
      "flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all",
      feeMode === 'holder_rewards' 
        ? "bg-primary/10 border-2 border-primary" 
        : "bg-secondary/30 border-2 border-transparent hover:bg-secondary/50"
    )}>
      <input 
        type="radio" 
        name="feeMode" 
        value="holder_rewards" 
        checked={feeMode === 'holder_rewards'}
        onChange={() => setFeeMode('holder_rewards')}
        className="sr-only"
      />
      <div className="flex-1">
        <div className="font-medium flex items-center gap-2">
          Holder Rewards 
          <Badge variant="secondary" className="bg-green-500/20 text-green-400">NEW</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Top 50 holders (min 0.3% balance) split 50% of fees every 5 min
        </div>
      </div>
    </label>
  </div>
</div>
```

**4.2 FunTokenDetailPage.tsx - Add Holder Rewards Display**

Show distribution info for holder_rewards tokens:

```tsx
{token.fee_mode === 'holder_rewards' && (
  <Card className="p-4">
    <h3 className="font-semibold mb-4 flex items-center gap-2">
      <Users className="h-4 w-4" />
      Holder Rewards
    </h3>
    
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <div className="text-2xl font-bold text-green-400">
          {poolBalance.toFixed(4)} SOL
        </div>
        <div className="text-sm text-muted-foreground">
          Next distribution pool
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold">
          {timeToNextDistribution}
        </div>
        <div className="text-sm text-muted-foreground">
          Until next payout
        </div>
      </div>
    </div>
    
    <div className="text-sm text-muted-foreground">
      Min holding: 0.3% of supply ({formatTokenAmount(3_000_000)} tokens)
    </div>
    <div className="text-sm text-muted-foreground">
      Total distributed: {totalDistributed.toFixed(4)} SOL
    </div>
  </Card>
)}
```

**4.3 TokenCard.tsx - Add Badge**

Show "Holder Rewards" badge on token cards:

```tsx
{token.fee_mode === 'holder_rewards' && (
  <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
    Holder Rewards
  </Badge>
)}
```

---

### Phase 5: Backend API Updates

**5.1 Update Token Creation Endpoints**

Files to modify:
- `supabase/functions/fun-create/index.ts`
- `supabase/functions/fun-phantom-create/index.ts`
- `api/pool/create-fun.ts`

Add `feeMode` parameter to token creation:

```typescript
// Accept feeMode from request
const { name, ticker, ..., feeMode } = await req.json();

// Validate
const validFeeModes = ['creator', 'holder_rewards'];
const tokenFeeMode = validFeeModes.includes(feeMode) ? feeMode : 'creator';

// Insert with fee_mode
await supabase.from('fun_tokens').insert({
  ...tokenData,
  fee_mode: tokenFeeMode,
});

// If holder_rewards, initialize pool
if (tokenFeeMode === 'holder_rewards') {
  await supabase.from('holder_reward_pool').insert({
    fun_token_id: tokenId,
    accumulated_sol: 0,
  });
}
```

**5.2 Add to supabase/config.toml**

```toml
[functions.fun-holder-distribute]
verify_jwt = false
```

---

### Phase 6: Cron Job Setup

Add 5-minute cron job for holder distribution:

```sql
SELECT cron.schedule(
  'fun-holder-distribute-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ptwytypavumcrbofspno.supabase.co/functions/v1/fun-holder-distribute',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/*.sql` | New | Database schema for holder rewards |
| `supabase/functions/fun-distribute/index.ts` | Modify | Add fee_mode routing logic |
| `supabase/functions/fun-holder-distribute/index.ts` | New | Main holder distribution function |
| `supabase/functions/fun-create/index.ts` | Modify | Accept feeMode parameter |
| `supabase/functions/fun-phantom-create/index.ts` | Modify | Accept feeMode parameter |
| `api/pool/create-fun.ts` | Modify | Accept feeMode parameter |
| `supabase/config.toml` | Modify | Add fun-holder-distribute |
| `src/components/launchpad/LaunchTokenForm.tsx` | Modify | Add fee mode selector UI |
| `src/pages/FunTokenDetailPage.tsx` | Modify | Display holder rewards info |
| `src/components/launchpad/TokenCard.tsx` | Modify | Add holder rewards badge |
| `src/hooks/useMeteoraApi.ts` | Modify | Pass feeMode to API |

---

## Safety Audit Checklist

- [ ] Snapshot locked before any holder data is fetched
- [ ] Payout records created before SOL transfers begin
- [ ] Failed transactions do NOT mark claims as distributed
- [ ] Pool accumulator only reset AFTER successful distribution
- [ ] Cron lock prevents concurrent distribution runs
- [ ] Treasury balance checked before each batch transfer
- [ ] Invalid wallets skipped (not failed) with error logging
- [ ] Skipped amounts preserved for next distribution cycle
- [ ] All holder data immutable once snapshot is locked
- [ ] Proportional math uses BigInt to prevent floating point errors

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database Schema | 1 day | None |
| Phase 2: Modify fun-distribute | 1 day | Phase 1 |
| Phase 3: fun-holder-distribute | 2 days | Phase 1, 2 |
| Phase 4: Frontend UI | 1 day | Phase 1 |
| Phase 5: Backend API Updates | 1 day | Phase 1 |
| Phase 6: Cron Job + Testing | 1 day | Phase 3 |

**Total: 7 days**

