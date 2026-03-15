

## Update "Share to X" Tweet Format

**Single file change:** `src/components/launchpad/ProfitCardModal.tsx`

Update `handleShareX` (line 95-103) to use the exact tweet format requested:

```
🔴 Sold $TRUMP | 0.0295 SOL
PNL - +12.5%
TX - abc123...xyz789

🪐Trade on @saturnterminal 🪐

https://saturn.trade
```

**Logic:**
- For sells: `🔴 Sold $TICKER | X.XXXX SOL`
- For buys: `🟢 Bought $TICKER | X.XXXX SOL`
- PNL line: show `PNL - +X.XX%` if available, omit line if no PnL data
- TX line: show truncated signature if available, omit if not
- Footer: `🪐Trade on @saturnterminal 🪐` + newline + referral link (or `https://saturn.trade`)

All data (`amountSol`, `pnlPercent`, `signature`, `tokenTicker`) is already available in the `data` prop — no new data needed.

