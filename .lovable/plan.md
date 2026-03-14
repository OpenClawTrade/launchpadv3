

## Plan: Fix Multiple UI Issues

This plan covers 7 distinct fixes across the platform.

---

### 1. Trade Page: Remove Duplicate "Connect Wallet" (EmbeddedWalletCard)

**Problem**: When not connected, the trade panel shows a "Connect Wallet" button AND the `EmbeddedWalletCard` below it also shows "Connect Wallet" — two connect prompts.

**Fix**: In `EmbeddedWalletCard.tsx`, when user is not authenticated, return `null` instead of showing a second connect button. The trade panels (UniversalTradePanel, TradePanelWithSwap, MobileTradePanelV2) already have their own connect buttons.

**File**: `src/components/launchpad/EmbeddedWalletCard.tsx` (lines 64-81) — return `null` when `!isAuthenticated`.

---

### 2. Mobile Buy/Sell Bottom Bar Button UI Fix

**Problem**: The fixed bottom BUY/SELL bar on mobile (FunTokenDetailPage lines 1015-1042) may clip or not show fully due to `bottom: 40px` and the bar styling.

**Fix**: In `src/pages/FunTokenDetailPage.tsx`, adjust the bottom bar to use proper spacing and ensure buttons have sufficient width. Add `min-w-[72px]` to both BUY and SELL buttons so they don't compress, and verify the bottom offset works with the mobile nav.

**File**: `src/pages/FunTokenDetailPage.tsx` (lines 1015-1042)

---

### 3. Fix Metadata: Remove `/t/` Fallback from `create-fun.ts`

**Problem**: `create-fun.ts` still has the broken `/t/` fallback URL (`https://tuna.fun/t/TICKER`) — this was fixed in `create.ts` and `create-phantom.ts` but missed here.

**Fix**: Change line 333-335 to `const finalWebsiteUrl = websiteUrl && websiteUrl.trim() !== '' ? websiteUrl : undefined;`

**File**: `api/pool/create-fun.ts` (lines 330-335)

---

### 4. Portfolio Section Overhaul

**Problem**: Portfolio shows all tokens with "0.000000 SOL" values, no pagination, no sell buttons, no PnL. The pie chart and list are oversized and ugly.

**Fix** in `src/components/panel/PanelUnifiedDashboard.tsx`:
- Add pagination to portfolio holdings (show 5 per page with Previous/Next)
- Filter out tokens with zero SOL value from display (or show them in a collapsed "dust" section)
- Add a small "Sell 100%" button on each token card that links to `/trade/:mint`
- Show PnL placeholder per token (we don't have cost basis data, so show current value)
- Make the pie chart more compact and the token cards smaller/tighter
- Cap the visible list to prevent the massive scrolling issue

---

### 5. Remove Comments from Platform-Launched Tokens

**Problem**: User wants to remove the comment/discussion section from tokens launched through the platform's own system (launchpad_type: 'phantom', 'saturn', or fun_tokens).

**Fix**: In `FunTokenDetailPage.tsx`, conditionally hide `CommentsSection` and the "comments" mobile tab for platform-launched tokens. Check `(token as any).launchpad_type` — if it's `'phantom'`, `'saturn'`, or if the token comes from `fun_tokens`, skip rendering CommentsSection. Also remove "comments" from the mobile tab array for these tokens.

Also in `TokenDetailPage.tsx`, remove the "discussion" tab content for platform tokens.

**Files**: `src/pages/FunTokenDetailPage.tsx`, `src/pages/TokenDetailPage.tsx`

---

### 6. Staking Text Update

**Problem**: Staking buttons say "Launching on 14th March" — needs updating.

**Fix**: Change the toast message in all 3 files to: "Staking on AI agents will become available soon with the $SATURN and $SOL coins."

**Files**:
- `src/components/home/TradingAgentsShowcase.tsx` (line 143)
- `src/pages/SaturnForumPage.tsx` (line 183)
- `src/components/trading/TradingAgentsShowcase.tsx` (line 127)

---

### 7. Leverage Trading — Assessment & Status

**Current state**: The leverage page uses Aster DEX via server-side API keys (`ASTER_API_KEY`, `ASTER_API_SECRET`) proxied through the `aster-trade` edge function. It does NOT currently support Privy wallet deposits to Aster. Trading is done via Aster's centralized API (not on-chain wallet signing). Users cannot deposit from their Privy wallet to Aster's supported currencies.

**Fix**: This is a complex integration that requires:
- Understanding Aster DEX's deposit API (if they have one)
- Bridging funds from Privy embedded wallet to Aster's custody
- This is NOT a quick fix — will note it as a future task and leave the current state as-is for now

No code changes for this item — will document the limitation.

---

### Summary of Files to Edit

| File | Change |
|------|--------|
| `src/components/launchpad/EmbeddedWalletCard.tsx` | Return null when not authenticated |
| `src/pages/FunTokenDetailPage.tsx` | Fix mobile bottom bar buttons, remove CommentsSection for platform tokens |
| `src/pages/TokenDetailPage.tsx` | Remove discussion tab for platform tokens |
| `api/pool/create-fun.ts` | Remove `/t/` fallback URL |
| `src/components/panel/PanelUnifiedDashboard.tsx` | Portfolio pagination, sell buttons, compact design, filter dust |
| `src/components/home/TradingAgentsShowcase.tsx` | Update staking text |
| `src/pages/SaturnForumPage.tsx` | Update staking text |
| `src/components/trading/TradingAgentsShowcase.tsx` | Update staking text |

