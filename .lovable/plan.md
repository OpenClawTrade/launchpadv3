

# Fix "Link X Account" Button + Add 0.05 SOL Minimum Withdrawal

## Problem 1: Link X Account Button Not Working

The "Link X Account" button on the Launches tab appears disabled/greyed out. This happens because `privyAvailable` returns `false` when the Privy provider hasn't fully loaded, rendering the `LinkXFallback` component (a permanently disabled button) instead of the functional `LinkXButton`.

**Fix:** Remove the `privyAvailable` check since the user is already authenticated (they're on the Panel page which requires login). If they're logged in, Privy is definitely available. The `LinkXButton` component already imports `usePrivy` directly, so it will work.

## Problem 2: Minimum 0.05 SOL Withdrawal

Currently there's no minimum withdrawal enforced in the Panel's Earnings tab claim flow. The AgentDashboardPage already has this check (`profile.pendingFees < 0.05`), but the main Panel Earnings tab does not.

**Fix:** Add a 0.05 SOL minimum to the claim button in `PanelEarningsTab.tsx`, disabling it when unclaimed is below 0.05 and showing a note about the minimum.

## Changes

### 1. `src/components/panel/PanelMyLaunchesTab.tsx`
- Remove the `usePrivyAvailable` import and check
- Always render `LinkXButton` when user has no Twitter linked (they're already authenticated to reach this page)

### 2. `src/components/panel/PanelEarningsTab.tsx`
- Add 0.05 SOL minimum constant
- Disable the "Claim" button when `unclaimed_sol < 0.05`
- Show "Min 0.05 SOL" label next to the claim button when below threshold
- Show the minimum withdrawal note in the summary section

### Technical Details

**PanelMyLaunchesTab.tsx** - Line 121 change:
```tsx
// Before:
{privyAvailable ? <LinkXButton /> : <LinkXFallback />}

// After:
<LinkXButton />
```
Also remove `LinkXFallback` component and `usePrivyAvailable` import.

**PanelEarningsTab.tsx** - Claim button change:
```tsx
const MIN_CLAIM_SOL = 0.05;

<Button
  size="sm"
  className="h-8 text-xs"
  disabled={
    !earning.unclaimed_sol || 
    earning.unclaimed_sol < MIN_CLAIM_SOL || 
    claimingTokenId === earning.token_id
  }
  onClick={() => handleClaim(earning.token_id)}
>
  {claimingTokenId === earning.token_id 
    ? <Loader2 className="h-4 w-4 animate-spin" /> 
    : earning.unclaimed_sol < MIN_CLAIM_SOL 
      ? "Min 0.05" 
      : "Claim"}
</Button>
```

