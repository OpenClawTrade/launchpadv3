

## Ultra-Fast Trade Execution System (Axiom-Level Speed)

### Current Bottlenecks

Your current flow has ~1.5-3 seconds of latency *before the transaction even hits the network*:

| Step | Current Latency | Where |
|------|----------------|-------|
| Balance check (RPC) | 200-500ms | `PulseQuickBuyButton.checkBalance()` |
| Get blockhash (RPC) | 200-500ms | `useSolanaWalletPrivy.signAndSendTransaction()` |
| Jupiter quote API | 300-600ms | `useJupiterSwap.getQuote()` |
| Jupiter swap API | 300-600ms | `useJupiterSwap` POST `/swap` |
| Dynamic import (Meteora SDK) | 100-300ms | `useRealSwap.swapBondingCurve()` |
| Dynamic import (bs58, web3.js) | 50-150ms | Multiple places |
| Privy sign | 50-200ms | Privy SDK |
| Privy sendTransaction (standard RPC) | 200-500ms | Primary path |
| Jito dual-submit | fire-and-forget | Secondary path |
| **Wait for confirmation** | **2-10 seconds** | Blocks UI |

**Total click-to-network: ~1.5-3s. Total click-to-UI-response: ~4-13s.**

Axiom achieves ~200-400ms click-to-network by eliminating every unnecessary step.

### Plan: 7 Optimizations

#### 1. Pre-cached Blockhash Service (`src/lib/blockhashCache.ts`)
Create a singleton that polls for fresh blockhashes every 2 seconds in the background. Every swap uses the cached value instantly (0ms) instead of making an RPC call (200-500ms).

```text
[Background poller] ──2s interval──> RPC getLatestBlockhash
                                         │
                                    cache.blockhash (always fresh)
                                         │
[Trade click] ──instant read──> use cached blockhash (0ms)
```

#### 2. Remove Pre-flight Balance Check
The `checkBalance()` call in `PulseQuickBuyButton` adds 200-500ms per trade. Remove it entirely — let the transaction fail on-chain naturally. The user already sees their balance in the UI. Saves 200-500ms.

#### 3. Jito as Primary Submission Path
Currently: Privy sends via standard Helius RPC (primary), then Jito fire-and-forget (secondary).

New: Build and sign the transaction ourselves, then submit directly to ALL Jito endpoints in parallel as the primary path, plus Helius as secondary. Jito validators give priority inclusion. This requires a new `sendRawTransaction` path that bypasses Privy's `signAndSendTransaction` for the send step — we still use Privy for signing only.

New hook: `useFastSwap.ts` — signs via Privy (`signTransaction`), then submits raw bytes to Jito + Helius simultaneously.

#### 4. Optimistic UI (Don't Wait for Confirmation)
Currently the UI blocks until `confirmTransaction()` resolves (2-10s). Change to optimistic: show success toast with signature immediately after submission. Confirmation polling moves to background. Saves 2-10 seconds of perceived latency.

#### 5. Eager Module Loading
Remove all `await import(...)` from the hot path. Pre-import Meteora SDK, bs58, web3.js at module level or via a warm-up function on page load. Saves 100-400ms.

#### 6. Skip Preflight Simulation
Pass `skipPreflight: true` and `preflightCommitment: 'processed'` to `sendRawTransaction`. Standard RPC preflight simulation adds ~200ms. Axiom skips this.

#### 7. Jupiter Fast Mode
Use Jupiter's `swapMode: 'ExactIn'` with `dynamicSlippage` and `prioritizationFeeLamports: 'auto'` already set (good), but also add `asLegacyTransaction: false` to ensure VersionedTransaction (smaller, faster). Pre-warm quote cache for the user's quick-buy amount when they hover a token card.

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/blockhashCache.ts` | Create | Background blockhash polling singleton |
| `src/hooks/useFastSwap.ts` | Create | Ultra-fast swap hook: sign-only + parallel Jito submit |
| `src/lib/jitoBundle.ts` | Modify | Add `sendRawToJitoAndHelius()` — parallel multi-endpoint raw tx submission |
| `src/hooks/useSolanaWalletPrivy.ts` | Modify | Add `signTransaction()` (sign-only, no send) method |
| `src/hooks/useRealSwap.ts` | Modify | Use fast path, remove blocking confirmation |
| `src/components/launchpad/PulseQuickBuyButton.tsx` | Modify | Remove balance check, use optimistic UI |
| `src/hooks/useJupiterSwap.ts` | Modify | Remove dynamic imports, use cached blockhash |

### Expected Result

```text
BEFORE:  Click → 200ms balance → 400ms blockhash → 500ms quote → 500ms swap-tx → 150ms sign → 300ms send → 5s confirm = ~7s total
AFTER:   Click → 0ms (no balance) → 0ms (cached blockhash) → 500ms quote+swap → 100ms sign → 50ms parallel-submit → optimistic done = ~650ms to UI response
```

The ~500ms Jupiter API round-trip is the irreducible minimum for graduated tokens (need fresh quote). For bonding curve tokens (Meteora), it can be even faster (~300ms) since we build the tx locally.

### Limitation Note
Privy's embedded wallet SDK may not expose a pure `signTransaction` without sending. If that's the case, we'll intercept the serialized+signed bytes from `signAndSendTransaction` before Privy sends them, and race our own Jito submission against Privy's RPC send. The dual-submit already does this partially — we just need to make Jito the priority path and make the UI not wait for confirmation.

