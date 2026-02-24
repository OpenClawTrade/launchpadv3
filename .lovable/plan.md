
# Quick Buy Default Amount Input + Card Spacing Fix

## 1. Persistent Quick Buy Amount Input (Axiom-style)

Add a small SOL amount input field in the Pulse header toolbar that persists the user's default buy amount. When users click "Buy" on any card, it uses this saved amount to execute immediately (one-click buy) instead of opening a popover to pick an amount.

### How It Works
- A compact input field appears in the Pulse toolbar header (next to the counter badge on the right side), showing something like: `[lightning] 0.5 SOL`
- The value is saved to `localStorage` under key `pulse-quick-buy-amount`
- Default value: `0.5` SOL
- Users can click the input, type a custom amount (e.g., 0.1, 1, 2, etc.), and it persists across sessions
- The `PulseQuickBuyButton` on each card reads this saved amount and executes immediately on click (no popover needed for the default amount)
- Long-press or right-click still opens the popover with preset amounts as a fallback

### Files to Modify

**`src/pages/TradePage.tsx`**
- Add state for `quickBuyAmount` initialized from `localStorage` (default `0.5`)
- Add a small inline input in the Pulse header toolbar (right side, before the counter badge)
- Input styling: compact, dark background, mono font, lightning icon prefix, "SOL" suffix label
- On change, save to `localStorage` and update state
- Pass `quickBuyAmount` down to `AxiomTerminalGrid`

**`src/components/launchpad/AxiomTerminalGrid.tsx`**
- Accept new prop `quickBuyAmount: number`
- Pass it through to `AxiomTokenRow` and `CodexPairRow`

**`src/components/launchpad/AxiomTokenRow.tsx`**
- Accept `quickBuyAmount` prop
- Pass it to `PulseQuickBuyButton`

**`src/components/launchpad/CodexPairRow.tsx`**
- Accept `quickBuyAmount` prop
- Pass it to `PulseQuickBuyButton`

**`src/components/launchpad/PulseQuickBuyButton.tsx`**
- Accept optional `quickBuyAmount` prop
- When `quickBuyAmount` is provided and user clicks the button, execute the swap immediately with that amount (skip the popover)
- The button label changes from "Buy" to show the amount, e.g., "0.5 SOL"
- Keep the popover as a secondary option (e.g., on a small dropdown arrow or long-press)

---

## 2. Card Spacing Fix

### Problem
Cards are touching edge-to-edge with `gap-0.5` (2px) -- looks cramped and unprofessional.

### Fix

**`src/components/launchpad/AxiomTerminalGrid.tsx`**
- In `renderColumnContent`, change the card list container from `gap-0.5 p-1` to `gap-3 p-2`
- In `PulseColumnSkeleton`, change from `gap-1 p-1.5` to `gap-3 p-2`

This gives 12px vertical spacing between cards with 8px padding around the column -- clean, professional breathing room without being too spread out for a dense terminal.

---

## Summary of Changes
| File | Change |
|------|--------|
| `TradePage.tsx` | Add quick buy amount input in header toolbar + state/localStorage |
| `AxiomTerminalGrid.tsx` | Accept + pass `quickBuyAmount` prop; fix `gap-0.5` to `gap-3` |
| `AxiomTokenRow.tsx` | Accept + pass `quickBuyAmount` to button |
| `CodexPairRow.tsx` | Accept + pass `quickBuyAmount` to button |
| `PulseQuickBuyButton.tsx` | Accept `quickBuyAmount`, execute immediately on click, show amount on button |

## What Stays Untouched
- Left sidebar -- 100% untouched
- Top app header -- 100% untouched
- All data hooks -- 100% untouched
- Card design/colors -- 100% untouched (only spacing between cards changes)
- Swap execution logic (`useRealSwap`) -- 100% untouched
