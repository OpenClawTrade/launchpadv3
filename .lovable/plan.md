
# Fix Partner Fee Split to Exclude Phantom Mode

## Problem Identified
The `fun-distribute` edge function applies partner fee splits to ALL token types except specific exclusions. Phantom mode tokens are being processed as "regular tokens" and incorrectly receiving partner splits.

## Current State
- Partner split is 50% of platform fees going to partner wallet
- Active until February 27, 2026
- Correctly excludes: Trading Agents, Bags, Holder Rewards, Agent tokens
- **Bug**: Does NOT exclude Phantom mode tokens

## Solution

### File to Modify
`supabase/functions/fun-distribute/index.ts`

### Changes Required

1. **Add Phantom detection in the main claim processing loop** (around line 257):
   - Check if `token.launchpad_type === 'phantom'` early in the claim processing
   - Skip partner split for Phantom tokens but still process creator distribution

2. **Update the regular token processing block** (around line 500-512):
   - Add condition to exclude Phantom tokens from partner split calculation
   - Keep creator fee distribution unchanged (50% to creator)

### Code Changes

**Change 1: Add Phantom check in isTokenEligibleForPartnerSplit or create separate check**

Add after line 30:
```typescript
// Check if a token is a Phantom-launched token (excluded from partner split)
function isPhantomToken(launchpadType: string | null | undefined): boolean {
  return launchpadType === 'phantom';
}
```

**Change 2: Update regular token partner split logic (lines 498-511)**

Current code:
```typescript
} else {
  // Regular tokens: creator gets 50%, rest for buyback/system
  recipientAmount = claimedSol * CREATOR_FEE_SHARE;
  platformAmount = claimedSol * (BUYBACK_FEE_SHARE + SYSTEM_FEE_SHARE);
  
  // Partner split from platform share
  if (isTokenEligibleForPartnerSplit(token.created_at)) {
    partnerAmount = platformAmount * 0.5;
    platformAmount = platformAmount * 0.5;
  }
```

New code:
```typescript
} else {
  // Regular tokens: creator gets 50%, rest for buyback/system
  recipientAmount = claimedSol * CREATOR_FEE_SHARE;
  platformAmount = claimedSol * (BUYBACK_FEE_SHARE + SYSTEM_FEE_SHARE);
  
  // Partner split from platform share - EXCLUDE Phantom mode tokens
  const isPhantom = token.launchpad_type === 'phantom';
  if (!isPhantom && isTokenEligibleForPartnerSplit(token.created_at)) {
    partnerAmount = platformAmount * 0.5;
    platformAmount = platformAmount * 0.5;
  }
```

**Change 3: Update console log to indicate Phantom exclusion (line 509-511)**

```typescript
console.log(
  `[fun-distribute] ${isPhantom ? 'Phantom' : 'Regular'} Token ${token.ticker}: ${claimedSol} SOL → Creator ${recipientAmount.toFixed(6)}, Platform ${platformAmount.toFixed(6)}${partnerAmount > 0 ? `, Partner ${partnerAmount.toFixed(6)}` : ''}${isPhantom ? ' (partner split excluded)' : ''}`
);
```

## Summary of Partner Split Behavior After Fix

| Mode | Partner Split Applied? |
|------|----------------------|
| Random/Describe/Custom (tuna) | Yes - 50% of platform share |
| Phantom | **No** - excluded |
| Holders | Yes - 50% of platform share |
| Bags | Yes - 50% of platform share |
| Agents | Yes - 50% of platform share |
| Trading Agents | Yes - 50% of platform share |
| API | Yes - 50% of platform share |

## Deployment
After the code change, the `fun-distribute` edge function will be automatically redeployed. No migration needed since this is a logic change only.
