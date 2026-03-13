

## Plan: Instant Execution Feedback + Immediate Sell Button Switch

### Problem
1. The success toast only appears after the full swap completes (quote → sign → broadcast → confirm), making it feel slow.
2. After buying, the Quick Buy button doesn't flip to "Sell All" until the balance query refetches (up to 15s delay).

### Changes

**`src/components/launchpad/PulseQuickBuyButton.tsx`**

**1. Two-phase toast for instant feedback:**
- Phase 1 (immediate, before swap call): Show `toast.success("✅ Trade Executed!")` with description "Confirming transaction..." right when the swap is initiated — replacing the current `toast.loading`.
- Phase 2 (on completion): Update the same toast ID with the TX signature and latency once the promise resolves.
- On error: Replace the toast with the error message.

This applies to both `handleTriggerClick` (quick-buy path) and `handleBuy` (popover preset path), and the sell flow.

**2. Optimistic button flip to "Sell All":**
- After a successful buy, immediately call `queryClient.setQueryData(["quick-sell-balance", walletAddress, mintAddress], 1)` to optimistically set a non-zero balance. This makes `hasBalance` become `true` instantly, flipping the button to "Sell 100%".
- The real balance will be fetched on the next refetch cycle and correct the value.
- Also reduce `staleTime` from 15s to 5s for faster real balance updates.

### Flow After Changes
```
User clicks "0.5 SOL" →
  Instantly: toast "✅ Trade Executed!" (confirming...) + button stays in loading state
  ~1-2s later: toast updates with "TX: abc123... · 1200ms" + button flips to "Sell 100%"
  On error: toast shows "❌ Trade Failed"
```

### Files Changed
- `src/components/launchpad/PulseQuickBuyButton.tsx` — both toast flow and optimistic balance update

