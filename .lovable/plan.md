

# Wire 0x swaps into /ape trade terminal

## Current state

The `/ape/:address` page (`src/pages/ApePage.tsx`) **looks** like a trade terminal but the buy/sell button is a plain link that opens Uniswap/PancakeSwap/Jupiter in a new tab. The `useZeroxSwap` hook exists and the `zerox-swap` edge function is fully built (1% platform fee → `0x9FD5…10B0`, allowance handling, ETH+BNB), but **nothing on the page calls it**.

What IS wired correctly:
- Token metadata, price, MC, vol, holders, liquidity, 24h change → `useExternalToken` (Codex) ✓
- Candlestick chart → `CodexChart` ✓
- Live trades table + filters ($500/$5K/whales) ✓
- Derived top holders ✓

What is NOT wired:
- Buy/Sell button → external link, not 0x ✗
- Quick-amount chips → `MAX` does nothing (no balance read) ✗
- Slippage value → never sent to 0x ✗
- "You get" estimate → fake formula `(amount × 3000) / price`, not a real 0x quote ✗
- Route label hard-coded "Uniswap/PancakeSwap" → should reflect actual 0x route ✗
- "YOUR TRADES" tab → no filter logic, shows all trades ✗
- Native balance / token balance → not displayed anywhere ✗
- Tx success / explorer link / toast → none ✗

## Plan

### 1. Wire the Buy/Sell CTA to 0x
- Replace the `<a href={dexFor(...)}>` CTA with a `<button>` that calls `executeApeSwap` from `useZeroxSwap`.
- For Solana addresses, keep the Uniswap-style link fallback (0x edge function only supports ETH+BNB today).
- Map UI slippage (`0.5 / 1 / AUTO`) → bps (`50 / 100 / 100`). AUTO uses 100 bps default.
- For sells, fetch token decimals from Codex `token` data (already in `useExternalToken`) and pass `tokenDecimals`.
- On success: toast with explorer link from `result.explorerUrl`; on error: toast destructive.
- Disable button while `isLoading`; show "SWAPPING…" label.

### 2. Real-time 0x quote (debounced)
- Add a `useEffect` that, when `amount > 0` and chain is eth/bsc, calls `zerox-swap` in `mode: "quote"` (debounced ~400 ms) to get `buyAmount`, `route`, `totalNetworkFee`, `minBuyAmount`.
- Replace the fake `estimatedTokens` calc with the real `buyAmount` (formatted by token decimals).
- Show `Min received` row using `minBuyAmount`.
- Show `Network fee` row using `totalNetworkFee`.
- Show real `Route` label from `quote.route?.fills?.[0]?.source` (e.g. "Uniswap_V3", "PancakeSwap_V3").

### 3. Wallet balances + MAX
- Use `usePrivyEvmWallet` to get the EVM address.
- Read native balance via provider `eth_getBalance` and ERC20 balance via `eth_call` to `balanceOf`.
- Display "Balance: 0.1234 ETH" under the amount input.
- `MAX` chip → fills with native balance minus a small gas buffer (0.001 ETH / 0.002 BNB) for buy, or full token balance for sell.

### 4. YOUR TRADES tab filter
- Filter `trades` by `t.maker.toLowerCase() === address.toLowerCase()` when `tradesTab === "yours"`.
- Empty state: "No trades from your wallet yet".

### 5. Edge cases
- If wallet not connected → CTA shows "Connect wallet" and triggers Privy login.
- If on wrong chain (e.g. Solana token but EVM wallet) → keep the existing external Jupiter link.
- If 0x quote returns `issues.balance` → show inline warning "Insufficient balance".
- If `issues.allowance` is set on a sell → CTA label becomes "APPROVE & SELL" (the hook already handles this in two txs).

## Files to edit

- `src/pages/ApePage.tsx` — replace CTA, add quote effect, balance reads, YOUR TRADES filter, route/min-received display.

## Files NOT changing

- `src/hooks/useZeroxSwap.ts` — already correct.
- `supabase/functions/zerox-swap/index.ts` — already correct (quote + record + 1% fee).

## Out of scope (call out, don't build)

- **Solana 0x routing** — 0x edge function currently only supports ETH+BNB. Solana tokens on `/ape/sol/...` will continue to use the Jupiter fallback link until a Jupiter-swap wiring is added.
- **Anti-MEV (Flashbots)** — the hook has a flag but the actual Flashbots routing requires raw signing not yet implemented.
- **Real-time price chart updates on swap** — Codex polling already refreshes; no extra work.

