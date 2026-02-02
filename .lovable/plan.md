
# New Fee Claim Flow: X Verification + User-Selected Payout Wallet

## Overview

Simplify the agent claim process by removing wallet requirements from both launching and claiming. The new flow:

1. **Launch via X** - No wallet needed in tweet (wallet becomes optional)
2. **Claim fees via X login** - User logs in with X, proving ownership
3. **Select payout wallet** - User picks any wallet to receive fees

---

## Current Problems

### 1. Wallet Required at Launch
Users must include a Solana wallet in their tweet to launch tokens. This adds friction and locks fees to that specific wallet forever.

### 2. Display Bug in `agent-find-by-twitter`
The function queries `fun_distributions` (already-paid fees) and labels them as "unclaimed" - this is backwards. Should query `fun_fee_claims` where `creator_distributed = false`.

### 3. Backend Wallet Matching in `agent-creator-claim`
Lines 131-147 require the claim wallet to match the launch wallet. Since X login already proves ownership, this restriction prevents users from receiving fees if they can't access their original wallet.

---

## New Flow

```text
LAUNCH FLOW (Updated)
─────────────────────
@user tweets: "!tunalaunch @BuildTuna
Name: MyToken
Symbol: MTK
(no wallet required)"

→ System generates token
→ Links token to X handle "user" (not to a wallet)

CLAIM FLOW (Updated)
────────────────────
1. User logs in with X on /agents/claim
2. System finds all tokens launched by that X handle
3. User sees: "You have 0.5 SOL unclaimed across 3 tokens"
4. User enters/selects destination wallet
5. User clicks "Claim to [wallet]"
6. System sends SOL to specified wallet
```

---

## Technical Changes

### Phase 1: Fix Display Bug

**File: `supabase/functions/agent-find-by-twitter/index.ts`**

Replace the broken unclaimed fee calculation (lines 165-180):

```typescript
// BEFORE (wrong):
const { data: distributions } = await supabase
  .from("fun_distributions")  // ← Wrong table
  .eq("distribution_type", "creator");

// AFTER (correct):
const { data: unclaimedFeeClaims } = await supabase
  .from("fun_fee_claims")
  .select("fun_token_id, claimed_sol")
  .in("fun_token_id", tokenIds)
  .eq("creator_distributed", false);  // Only pending fees
```

Update the pseudo-agent unclaimed calculation (lines 276-291) to use the corrected map.

---

### Phase 2: Allow User-Selected Payout Wallet

**File: `supabase/functions/agent-creator-claim/index.ts`**

Changes:
1. Remove wallet matching validation (lines 131-147)
2. Accept user-provided `payoutWallet` in request
3. Send fees to user's chosen wallet instead of launch wallet

New request interface:
```typescript
interface ClaimRequest {
  twitterUsername: string;
  payoutWallet: string;  // User-selected destination
  tokenIds?: string[];
  checkOnly?: boolean;
}
```

Security: X login proves ownership. The payout wallet is user's choice.

---

### Phase 3: Make Wallet Optional in Launch

**File: `supabase/functions/agent-process-post/index.ts`**

Changes:
1. Make wallet field optional in `ParsedLaunchData`
2. Update `parseLaunchPost()` to not require wallet
3. Use placeholder or null for `creator_wallet` in tokens table

```typescript
// BEFORE:
if (!data.name || !data.symbol || !data.wallet) {
  return null;  // Rejected without wallet
}

// AFTER:
if (!data.name || !data.symbol) {
  return null;  // Wallet is optional
}
```

**File: `supabase/functions/agent-social-posts` (and related)**
- Store the X handle as the primary identifier for fee ownership
- `post_author` becomes the authoritative link (already stored)

---

### Phase 4: Update Claim Page UI

**File: `src/pages/AgentClaimPage.tsx`**

Changes:
1. Add wallet input field where user can enter/paste destination wallet
2. Remove wallet matching requirement for fee claims (already done in backend)
3. Show clear messaging: "Where should we send your fees?"

New UI section:
```text
┌─────────────────────────────────────┐
│  Claim Fees                         │
│                                     │
│  You have 0.52 SOL unclaimed        │
│                                     │
│  Send to: [_________________________]│
│           ↑ Paste any Solana wallet │
│                                     │
│  [Claim 0.52 SOL]                   │
└─────────────────────────────────────┘
```

---

## Database Considerations

The `agent_social_posts` table already stores:
- `post_author` - X handle (the ownership proof)
- `wallet_address` - Was used as payout destination

With this change:
- `post_author` remains the source of truth for ownership
- Payout destination is provided at claim time (not stored permanently)

---

## Security Model

| Check | How It Works |
|-------|--------------|
| Ownership proof | X OAuth login verifies user controls the X account |
| Token linkage | `agent_social_posts.post_author` matches X handle |
| Payout destination | User provides any valid Solana wallet at claim time |
| Double-spend prevention | `fun_fee_claims.creator_distributed` flag |
| Rate limiting | 1 claim per hour per X handle (not per wallet) |

---

## Migration Notes

For existing tokens with wallets specified:
- No migration needed
- System will still find them via `post_author`
- Users can claim to any wallet regardless of what was in their original tweet

---

## Summary of File Changes

| File | Change |
|------|--------|
| `agent-find-by-twitter/index.ts` | Fix unclaimed fee calculation |
| `agent-creator-claim/index.ts` | Accept user payout wallet, remove matching requirement |
| `agent-process-post/index.ts` | Make wallet optional in launch parsing |
| `AgentClaimPage.tsx` | Add wallet input for payout destination |

