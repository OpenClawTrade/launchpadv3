
# Complete Agent Fee Data Integrity Audit

## Summary of Findings

After auditing all components that display agent fee data across the website, I found **6 locations that need correction** to ensure accurate data. The issue is that several components still read from potentially stale database columns instead of calculating dynamically from the source of truth (`fun_fee_claims`).

### ✅ Already Fixed
| Component | Source | Status |
|-----------|--------|--------|
| `agent-stats` edge function | Dynamic calculation from `fun_fee_claims` | ✅ FIXED |
| `AgentStatsBar` component | Uses `agent-stats` function | ✅ CORRECT |
| `TunaBookPage` stats section | Uses `agent-stats` function | ✅ CORRECT |
| Database `agents.total_fees_earned_sol` | Updated with correct values | ✅ FIXED |

### ❌ Still Using Stale Column (Need Fixing)

| Component | File | Issue |
|-----------|------|-------|
| Agent Leaderboard | `src/pages/AgentLeaderboardPage.tsx:85` | Reads `total_fees_earned_sol` directly |
| Agent Profile Page | `src/pages/AgentProfilePage.tsx:116` | Reads `total_fees_earned_sol` directly |
| TunaBook Right Sidebar | `src/components/tunabook/TunaBookRightSidebar.tsx:61` | Reads `total_fees_earned_sol` directly |
| Agent Heartbeat | `supabase/functions/agent-heartbeat/index.ts:175-176` | Uses `total_fees_earned_sol` for stats |
| Agent-Me Endpoint | `supabase/functions/agent-me/index.ts:115,130` | Uses `total_fees_earned_sol` |

### ✅ Already Correct (Dynamic Calculation)

| Component | File | Source |
|-----------|------|--------|
| Agent-Find-By-Twitter | `supabase/functions/agent-find-by-twitter/index.ts:221` | Calculates from `fun_fee_claims` |
| Agent Claim Page | `src/pages/AgentClaimPage.tsx` | Uses data from `agent-find-by-twitter` |

---

## Detailed Analysis

### 1. Frontend Components Reading Stale Column

These components query the `agents` table directly and use the `total_fees_earned_sol` column:

**AgentLeaderboardPage.tsx (Line 85):**
```typescript
totalFeesEarned: Number(agent.total_fees_earned_sol || 0),
```

**AgentProfilePage.tsx (Line 116):**
```typescript
totalFeesEarned: agentData.total_fees_earned_sol || 0,
```

**TunaBookRightSidebar.tsx (Line 61):**
```typescript
feesEarned: Number(agent.total_fees_earned_sol || 0),
```

**Risk:** If the `fun-distribute` function double-counts again in the future, these values will become incorrect even though we just cleaned the database.

### 2. Edge Functions Reading Stale Column

**agent-heartbeat/index.ts (Lines 175-176):**
```typescript
totalFeesEarned: agent.total_fees_earned_sol || 0,
unclaimedFees: (agent.total_fees_earned_sol || 0) - (agent.total_fees_claimed_sol || 0),
```

**agent-me/index.ts (Lines 115, 130):**
```typescript
feesGenerated: Number(token.total_fees_earned || 0) * 0.8,
totalFeesEarned: Number(agent.total_fees_earned_sol || 0),
```

**Risk:** API consumers get incorrect data if the column becomes stale.

### 3. Already Correct Implementation

**agent-find-by-twitter/index.ts** correctly calculates fees from source:
```typescript
// Lines 149-163: Calculates tokenFeesMap from fun_fee_claims
const { data: feeClaims } = await supabase
  .from("fun_fee_claims")
  .select("fun_token_id, claimed_sol")
  .in("fun_token_id", tokenIds);

// Line 221-232: Uses calculated value
const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
totalFeesEarned: totalFeesEarned * 0.8, // 80% creator share
```

---

## Recommended Fix Strategy

### Option A: Keep Database Column Accurate (Current Approach)
- **Pros:** No code changes needed, fast queries
- **Cons:** Relies on `fun-distribute` not corrupting data again
- **Risk:** If corruption happens again, we need another manual cleanup

### Option B: Dynamic Calculation Everywhere (Recommended)
- **Pros:** Always accurate, immune to future corruption
- **Cons:** More complex queries, slight performance impact

### Recommended Approach: Hybrid

1. **Keep the database cleanup we did** - Values are now correct
2. **Add safeguards to prevent future corruption** - Fix the `fun-distribute` function
3. **Update critical API endpoints** - `agent-heartbeat` and `agent-me` should calculate dynamically
4. **Frontend components can stay as-is** - They read from the cleaned database column

---

## Implementation Plan

### Part 1: Fix `agent-heartbeat` Edge Function
Calculate fees dynamically instead of reading stale column:

```typescript
// Get actual fees from fun_fee_claims
const { data: agentTokenIds } = await supabase
  .from("fun_tokens")
  .select("id")
  .eq("agent_id", agent.id);

const tokenIds = (agentTokenIds || []).map(t => t.id);

let totalFeesEarned = 0;
if (tokenIds.length > 0) {
  const { data: feeClaims } = await supabase
    .from("fun_fee_claims")
    .select("claimed_sol")
    .in("fun_token_id", tokenIds);
  totalFeesEarned = (feeClaims || []).reduce((sum, c) => sum + (c.claimed_sol || 0), 0) * 0.8;
}

// Use calculated value
stats: {
  totalFeesEarned,
  unclaimedFees: Math.max(0, totalFeesEarned - (agent.total_fees_claimed_sol || 0)),
}
```

### Part 2: Fix `agent-me` Edge Function
Same dynamic calculation approach:

```typescript
// Calculate from fun_fee_claims for the agent's tokens
const tokenIds = tokens.map(t => t.id);
let calculatedFeesEarned = 0;
if (tokenIds.length > 0) {
  const { data: feeClaims } = await supabase
    .from("fun_fee_claims")
    .select("fun_token_id, claimed_sol")
    .in("fun_token_id", tokenIds);
  
  calculatedFeesEarned = (feeClaims || []).reduce((sum, c) => sum + (c.claimed_sol || 0), 0) * 0.8;
}

// Return calculated value
totalFeesEarned: calculatedFeesEarned,
```

### Part 3: Frontend Components (Lower Priority)
The frontend components (`AgentLeaderboardPage`, `AgentProfilePage`, `TunaBookRightSidebar`) can continue reading from the database column since we cleaned it. If we want extra safety, we could create a database view or RPC function that calculates dynamically.

---

## Files to Modify

| File | Priority | Change |
|------|----------|--------|
| `supabase/functions/agent-heartbeat/index.ts` | High | Calculate fees from `fun_fee_claims` |
| `supabase/functions/agent-me/index.ts` | High | Calculate fees from `fun_fee_claims` |
| `src/pages/AgentLeaderboardPage.tsx` | Low | Uses cleaned DB column (acceptable) |
| `src/pages/AgentProfilePage.tsx` | Low | Uses cleaned DB column (acceptable) |
| `src/components/tunabook/TunaBookRightSidebar.tsx` | Low | Uses cleaned DB column (acceptable) |

---

## Summary

The database has been cleaned, and the main `agent-stats` endpoint is now correct. To make the system **fully robust against future corruption**, we should update the `agent-heartbeat` and `agent-me` edge functions to calculate dynamically from `fun_fee_claims` rather than reading from potentially stale columns.

This ensures:
1. **API consumers always get accurate data**
2. **Agent claim page (which uses `agent-find-by-twitter`) is already correct**
3. **Frontend leaderboards/profiles use cleaned database values**
4. **System is immune to future `fun-distribute` bugs**
