
# Bags.fm Agent Integration Plan

## Overview
Integrate bags.fm as a third token launch platform alongside TUNA (Meteora DBC) and pump.fun. Bags-launched tokens will have their own "Bags Agents" section, a distinctive badge, and platform takes 100% of fees (vs 20% for TUNA agents).

---

## Architecture Summary

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         TUNA Agent Platform                         │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│     TUNA Agents     │    PUMP Agents      │      BAGS Agents        │
│   (Meteora DBC)     │   (pump.fun)        │      (bags.fm)          │
├─────────────────────┼─────────────────────┼─────────────────────────┤
│  80% Creator        │  80% Creator        │  100% Platform          │
│  20% Platform       │  20% Platform       │  0% Creator             │
├─────────────────────┼─────────────────────┼─────────────────────────┤
│  Purple AI Badge    │  Green Pump Pill    │  Bags.fm Icon           │
│  $69K graduation    │  $80K graduation    │  Meteora DBC pools      │
└─────────────────────┴─────────────────────┴─────────────────────────┘
```

---

## Phase 1: Database Schema Updates

### 1.1 Update `fun_tokens` Table
Add support for `launchpad_type = 'bags'`:

```sql
-- Add bags-specific columns
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_pool_address text;
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_creator text;
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_signature text;

-- Add constraint for launchpad_type
-- Current values: 'meteora', 'pumpfun'
-- New value: 'bags'
```

### 1.2 Create `bags_fee_claims` Table
Track fee claims from bags.fm tokens (similar to `pumpfun_fee_claims`):

```sql
CREATE TABLE bags_fee_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id uuid REFERENCES fun_tokens(id),
  mint_address text NOT NULL,
  claimed_sol numeric NOT NULL DEFAULT 0,
  signature text,
  distributed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bags_fee_claims_token ON bags_fee_claims(fun_token_id);
CREATE INDEX idx_bags_fee_claims_distributed ON bags_fee_claims(distributed);
```

---

## Phase 2: Backend Edge Functions

### 2.1 `bags-agent-launch` (New)
Core token launch function using Bags SDK:

**Workflow:**
1. Receive request (name, ticker, description, imageUrl, socials)
2. Upload image to Supabase storage if base64
3. Call Bags API: `createTokenInfoAndMetadata`
4. Configure fees via `createBagsFeeShareConfig` (100% to platform treasury)
5. Execute launch via `createLaunchTransaction`
6. Sign with deployer keypair and submit via Jito
7. Save to `fun_tokens` with `launchpad_type = 'bags'`
8. Create SubTuna community

**Required Secrets:**
- `BAGS_API_KEY` - From dev.bags.fm
- `BAGS_DEPLOYER_PRIVATE_KEY` - Deployer wallet for bags launches

### 2.2 `bags-data-sync` (New)
Fetch live data from bags.fm API for our tracked tokens:

**Functionality:**
- Query bags.fm API for token stats (price, mcap, holders)
- Update `fun_tokens` table with latest data
- Detect graduated tokens (migrated to Raydium)

### 2.3 `bags-claim-fees` (New)
Collect platform fees from bags-launched tokens:

**Key Difference:** 100% of fees go to platform treasury (no creator split)

**Workflow:**
1. Query all active bags tokens
2. For each token, call Bags API to claim accrued fees
3. Record in `bags_fee_claims` table
4. All fees remain with platform (no distribution)

### 2.4 Update `pumpfun-trending-sync`
Add bags.fm trending data alongside pump.fun:

```typescript
// Add bags trending fetch
const bagsTokens = await fetchBagsTrending();
await supabase.from("pumpfun_trending_tokens").upsert(
  bagsTokens.map(t => ({ ...t, source: 'bags' }))
);
```

---

## Phase 3: Frontend Components

### 3.1 `BagsBadge.tsx` (New)
Visual badge for bags.fm tokens (similar to PumpBadge):

```typescript
// Design: Bags.fm blue/purple gradient icon
// Links to: https://bags.fm/{mintAddress}
// Appears on: TokenCard, TokenTable, TokenDetail
```

**Asset Required:** Download/create bags.fm icon (bags-icon.webp)

### 3.2 `BagsAgentsPage.tsx` (New)
Dedicated page for bags.fm agent creation:

**UI Components:**
- Header with bags.fm + TUNA logo combo
- AI meme generator (reuse from PumpAgentsPage)
- "Launch on bags.fm" button
- Success state with CA display
- Info about 100% platform fee model

### 3.3 Update Navigation

**AppHeader.tsx additions:**
```typescript
// Add "Bags Agents" nav item
<Link to="/agents/bags">
  <Button size="sm">
    <BagsIcon className="h-4 w-4 mr-1.5" />
    Bags Agents
  </Button>
</Link>
```

**Mobile menu:** Add Bags Agents link

### 3.4 Update Token Components

**TokenCard.tsx:**
```typescript
// Add badge logic
{launchpad_type === 'bags' && <BagsBadge mintAddress={mint_address} />}
{launchpad_type === 'pumpfun' && <PumpBadge mintAddress={mint_address} />}
```

**TokenTable.tsx:** Same badge logic in table rows

**FunTokenDetailPage.tsx:** Show bags.fm link and badge on detail page

### 3.5 Update AgentTokenGrid
Add "Bags" tab filter alongside "TUNA" and "PUMP" tabs

---

## Phase 4: Fee System Integration

### 4.1 Fee Flow for Bags Tokens

```text
User Trade on bags.fm
        │
        ▼
   Bags.fm takes standard fee
        │
        ▼
   Platform claims via bags-claim-fees
        │
        ▼
   100% to Treasury (no creator split)
```

### 4.2 Update `fun-distribute` Edge Function
Skip distribution for bags tokens (platform keeps all):

```typescript
// In distribute logic
if (token.launchpad_type === 'bags') {
  // No creator distribution - platform retains 100%
  continue;
}
```

### 4.3 Dashboard Updates
Exclude bags tokens from creator fee dashboards (they don't receive splits)

---

## Phase 5: Routing & App Updates

### 5.1 Add Routes (App.tsx)
```typescript
const BagsAgentsPage = lazy(() => import("./pages/BagsAgentsPage"));

// In Routes
<Route path="/agents/bags" element={<BagsAgentsPage />} />
```

### 5.2 Update Agent Stats
Include bags.fm token counts in platform statistics

---

## Technical Details

### Bags SDK Integration

**API Base:** `https://public-api-v2.bags.fm/api/v1/`

**Authentication:**
```typescript
headers: {
  'x-api-key': BAGS_API_KEY,
  'Content-Type': 'application/json'
}
```

**Launch Transaction Flow:**
```typescript
// 1. Create metadata
const metadata = await fetch(`${BAGS_API}/token-launch/create-token-info-and-metadata`, {
  method: 'POST',
  body: JSON.stringify({ name, symbol, description, image }),
});

// 2. Configure fee share (10000 BPS = 100% to treasury)
const feeConfig = await fetch(`${BAGS_API}/fee-share/create-config-transaction`, {
  method: 'POST',
  body: JSON.stringify({
    feeClaimers: [{ address: TREASURY_ADDRESS, bps: 10000 }]
  }),
});

// 3. Create launch transaction
const launchTx = await fetch(`${BAGS_API}/token-launch/create-launch-transaction`, {
  method: 'POST',
  body: JSON.stringify({ metadataUri, mintKeypair }),
});

// 4. Sign and submit via Jito
```

### Vanity Address Support
Reuse existing TNA vanity keypair system for bags launches (consistent CA suffixes)

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/bags-agent-launch/index.ts` | Token launch on bags.fm |
| `supabase/functions/bags-data-sync/index.ts` | Sync live data from bags.fm |
| `supabase/functions/bags-claim-fees/index.ts` | Collect platform fees |
| `src/pages/BagsAgentsPage.tsx` | Bags agent creation UI |
| `src/components/tunabook/BagsBadge.tsx` | Visual badge component |
| `src/assets/bags-icon.webp` | Bags.fm icon asset |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add /agents/bags route |
| `src/components/layout/AppHeader.tsx` | Add Bags nav link |
| `src/components/launchpad/TokenCard.tsx` | Add BagsBadge logic |
| `src/components/launchpad/TokenTable.tsx` | Add BagsBadge logic |
| `src/pages/FunTokenDetailPage.tsx` | Show bags.fm links |
| `src/components/agents/AgentTokenGrid.tsx` | Add Bags tab filter |
| `supabase/functions/fun-distribute/index.ts` | Skip bags distribution |
| `supabase/config.toml` | Register new functions |

---

## Required Secrets

| Secret | Description |
|--------|-------------|
| `BAGS_API_KEY` | API key from dev.bags.fm |
| `BAGS_DEPLOYER_PRIVATE_KEY` | Wallet for signing bags launches |

---

## Estimated Implementation Order

1. **Database migration** (schema updates)
2. **bags-agent-launch** Edge Function (core launch logic)
3. **BagsBadge component** + asset
4. **BagsAgentsPage** (UI for launching)
5. **Routing + navigation updates**
6. **bags-data-sync** (live data updates)
7. **bags-claim-fees** (fee collection)
8. **Update distribution logic** (skip bags tokens)
9. **Testing end-to-end**
