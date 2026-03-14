

## Plan: Add Token Icon and PnL to Trade Success Popup

### Changes

**1. Extend `TradeSuccessData` store** (`src/stores/tradeSuccessStore.ts`)
- Add `tokenImageUrl?: string` — token icon URL
- Add `pnlSol?: number` — profit/loss in SOL (for sells)
- Add `pnlPercent?: number` — profit/loss percentage (for sells)

**2. Update `TradeSuccessPopup` UI** (`src/components/TradeSuccessPopup.tsx`)
- Add a token icon (rounded image, ~36px) next to the check icon in the headline row. Falls back to a coin placeholder icon if no image.
- For sell trades, add a PnL row in the details grid showing SOL gain/loss with green (profit) or red (loss) coloring and percentage.

**3. Pass token image and PnL from call sites** (`src/components/launchpad/PulseQuickBuyButton.tsx`)
- All `showTradeSuccess()` calls already have access to `token.image_url` via `bridgeFunToken`/`bridgeCodexToken` — pass it as `tokenImageUrl`.
- For sell calls, pass `pnlSol` and `pnlPercent` if available from the swap result (or compute from `solOut` vs cost basis if tracked). Initially, pass `solOut` from the result as a display value.

### Layout Update (headline row)

```text
[Token Icon 36px] [Check Circle] "Sold 100% of $SPEED"
```

The token icon sits before the check mark — a small rounded image with a border. On sells, a new detail row appears:

```text
PnL                    +0.12 SOL (+24.5%)   ← green
PnL                    -0.05 SOL (-8.2%)    ← red
```

