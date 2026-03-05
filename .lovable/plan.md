

## Problems Identified

### 1. "No Route Found" Bug
In `UniversalTradePanel.tsx` line 41: `const useJupiterRoute = token.graduated !== false;`  
When Jupiter fails to find a quote (returns null), the button shows "No route found" and is **disabled** — user cannot trade at all. There is no fallback to PumpPortal.

**Fix**: When Jupiter quote fails, allow the trade anyway via PumpPortal fallback. Remove the hard gate that requires a quote before enabling the button.

### 2. Jito Infrastructure Exists but Is Never Used
`src/lib/jitoBundle.ts` has full Jito bundle submission code but **zero imports** anywhere in the project. All swaps currently go through Privy's standard `signAndSendTransaction` which uses the regular Helius RPC — no Jito fast-lane.

### 3. Privy Popup Already Suppressed
`useSolanaWalletPrivy.ts` already sets `showWalletUIs: false` — confirmed working.

---

## Plan for Axiom-Like Speed

### Architecture: Jito `sendTransaction` Endpoint (not bundles)

Axiom and other fast trading bots use **Jito's `sendTransaction` endpoint** (`https://mainnet.block-engine.jito.wtf/api/v1/transactions`), which:
- Acts as a proxy to Solana's sendTransaction RPC
- Routes directly to Jito validators for faster block inclusion
- Supports priority fees for landing priority
- Does NOT require bundling or tips (tips optional for priority)

This is simpler and faster than full bundle submission for single-transaction swaps.

### Files to Modify

#### 1. `src/hooks/useSolanaWalletPrivy.ts` — Add Jito Fast Send
- After Privy signs + sends via standard RPC, **also** submit the same signed transaction to Jito's `sendTransaction` endpoint as a parallel "fast lane"
- Alternatively: since Privy's `signAndSendTransaction` both signs AND sends, we can't separate them. Instead, after getting the signature back, we fire-and-forget the same serialized tx to Jito endpoints for redundancy
- **Better approach**: Create a new `signAndSendTransactionFast` method that:
  1. Uses Privy to sign + send (standard path, returns signature)
  2. Simultaneously submits to Jito `sendTransaction` endpoint for faster landing
  3. Both paths race — whichever confirms first wins

#### 2. `src/components/launchpad/UniversalTradePanel.tsx` — Fix "No Route Found"
- When Jupiter quote fails, fall back to PumpPortal instead of disabling the button
- Change routing logic: try Jupiter first, if quote is null, switch `useJupiterRoute` to false dynamically
- Remove the disabled condition that requires `quote` when `useJupiterRoute` is true
- In `handleTrade`: if Jupiter route was intended but no quote exists, use PumpPortal as fallback

#### 3. `src/hooks/useJupiterSwap.ts` — Add Jito Submission
- In `executeSwap`, after deserializing the Jupiter swap transaction:
  - Sign via Privy (existing flow)
  - Also submit to Jito's `sendTransaction` endpoint in parallel for faster landing

#### 4. `src/lib/jitoBundle.ts` — Add `sendTransactionViaJito` Helper
- Add a lightweight function (separate from bundles) that submits a single signed transaction to Jito's `/api/v1/transactions` endpoint
- Multiple region failover (existing endpoint list)
- This is what Axiom uses for fast execution

#### 5. `src/hooks/useRealSwap.ts` — Integrate Jito Fast Send
- After Privy signs the Meteora DBC swap tx, also submit via Jito for faster landing

### Summary of Speed Improvements
- **Dual-submit**: Every signed transaction goes to both standard RPC (via Privy) AND Jito's fast endpoint simultaneously
- **Priority fees**: Already in Jupiter swap params (`prioritizationFeeLamports: 'auto'`), keep as-is
- **No popup**: Already implemented via `showWalletUIs: false`
- **Route fallback**: Jupiter → PumpPortal fallback eliminates "No route found" dead ends

