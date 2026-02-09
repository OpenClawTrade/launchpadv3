

## Fix: Limit Order Token Amount Off by Decimals

### Problem
The Take-Profit limit order is being placed with the wrong token amount. The SWAP correctly buys ~2,371,572 AI tokens, but the PLACE ORDER only lists ~2.37 AI tokens -- off by a factor of 1,000,000.

**Root cause:** In `trading-agent-execute/index.ts` (lines 626-632), there's a flawed heuristic:

```text
if (tokensReceived > 1_000_000) {
  rawTokenAmount = Math.floor(tokensReceived);     // <-- BUG: skips decimal conversion
} else {
  rawTokenAmount = Math.floor(tokensReceived * 10^decimals);
}
```

`tokensReceived` is always in **human-readable units** (e.g., 2,371,572.3 tokens). Jupiter's `makingAmount` expects **raw smallest units** (e.g., for 6 decimals: 2,371,572,300,000). The `> 1M` check incorrectly assumes large numbers are already in raw units and skips the conversion.

### Fix
Remove the broken heuristic and always multiply by `10^decimals`:

```text
const rawTokenAmount = Math.floor(tokensReceived * Math.pow(10, tokenDecimals));
```

This single-line change in `supabase/functions/trading-agent-execute/index.ts` (replacing lines 626-632) ensures the limit order always uses the correct raw token amount, regardless of how many tokens were received.

### Technical Details
- **File**: `supabase/functions/trading-agent-execute/index.ts`, lines 626-632
- **Change**: Replace the `if/else` block with a single line that always applies decimal conversion
- The `tpSolLamports` calculation on line 635 is correct (it uses `tokensReceived` in human units times price times 1e9 for lamports)
- No other files need changes

