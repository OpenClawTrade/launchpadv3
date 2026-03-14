

## Investigation Summary

### Issue 1: Swaps slower on domain (12.8s vs fast on Lovable preview)

**Root cause**: The Jupiter proxy edge function adds unnecessary latency. Every swap now makes **2 sequential round-trips** through the Supabase edge function (`jupiter-proxy`) instead of calling Jupiter directly:

1. Client → Edge Function → Jupiter Quote → Edge Function → Client (~500-1000ms overhead)
2. Client → Edge Function → Jupiter Swap → Edge Function → Client (~500-1000ms overhead)

On Lovable preview, the original code called `api.jup.ag` directly from the browser — no proxy overhead. Since Jupiter confirmed there is **no domain whitelisting**, the proxy is unnecessary. The original 401 error was likely caused by the API key not being included properly in the frontend build.

Additionally, all 5 Jito `sendTransaction` calls are returning **400 Bad Request** — the transaction was already sent via Privy's `signAndSendTransaction`, so the Jito fan-out is trying to re-send an already-processed transaction (stale blockhash / duplicate signature), wasting network time.

**Plan**:
1. **Remove the jupiter-proxy middleman** — revert `useJupiterSwap.ts` to call `api.jup.ag` directly with the API key from `VITE_JUPITER_API_KEY` env var (already set in Vercel). This eliminates ~1-2s of proxy latency.
2. **Fix Jito fan-out** — skip Jito `sendRawToAllEndpoints` when using `signAndSendTransaction` (Privy already submits the tx). The fire-and-forget calls are harmless but noisy; guard them to only fire when using `signTransaction` (sign-only path).

---

### Issue 2: PnL card missing +/- on the right side

Looking at the screenshot: the card shows "RECEIVED 0.0293 SOL" for a sell, but **no profit/loss indicator** on the right side.

**Root cause**: In `ProfitCardModal.tsx`, the right-side "Amount" section (lines 185-196) is wrapped in `{hasPnl && (...)}`. When `pnlPercent` is not provided (which happens for most trades since cost basis isn't tracked), the entire right column disappears.

**Plan**:
- When `hasPnl` is false for sells, show the SOL amount on the right side with a green "+" or just the amount received
- For sells without PnL data, display a "Received" label with the SOL value on the right side so the card doesn't look empty
- For buys without PnL, show "Invested" with the amount on the right

---

### Files to modify:
- `src/hooks/useJupiterSwap.ts` — revert to direct Jupiter API calls (remove proxy)
- `src/hooks/useSolanaWalletPrivy.ts` — suppress Jito fan-out after `signAndSendTransaction`
- `src/components/launchpad/ProfitCardModal.tsx` — always show right-side amount info

